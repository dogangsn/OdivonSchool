import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';
import type { Firestore, DocumentReference, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import type { Messaging } from 'firebase-admin/messaging';
import {
  AssignmentLite,
  ClassLite,
  DAY,
  PoolUpdateLite,
  PushMessage,
  StudentClassData,
  TeacherClassDay,
  UserLite,
  assignmentKey,
  buildStudentDigest,
  buildTeacherDigest,
  chunk,
  defaultAppUrl,
  isDeadTokenError,
  isStudentRole,
  istanbulDayKey,
  mapLimit,
  tomorrowRange,
} from './notifyLogic';

/** Upper bounds so one run stays well inside the 9-minute limit and the free quotas. */
const MAX_TOKENS = 20000;
const MAX_CLASSES_PER_STUDENT = 20;
const MAX_CLASSES = 3000;
const MAX_POOL_UPDATES = 500;
const CONCURRENCY = 20;

/** notifyState/{uid}: server-only bookkeeping (no client rule → not readable by clients). */
const STATE_COLLECTION = 'notifyState';

interface TokenRef {
  ref: DocumentReference;
  token: string;
}

export interface DigestStats {
  tokens: number;
  users: number;
  sent: number;
  skipped: number;
  deadTokens: number;
  failures: number;
}

function toAssignment(classId: string, d: QueryDocumentSnapshot): AssignmentLite {
  const x = d.data();
  return {
    id: d.id,
    classId,
    title: String(x.title ?? 'Ödev'),
    subject: x.subject,
    dueAt: typeof x.dueAt === 'number' ? x.dueAt : null,
    createdAt: typeof x.createdAt === 'number' ? x.createdAt : 0,
  };
}

async function loadTokens(db: Firestore): Promise<Map<string, TokenRef[]>> {
  const byUid = new Map<string, TokenRef[]>();
  let last: QueryDocumentSnapshot | undefined;
  let count = 0;
  while (count < MAX_TOKENS) {
    let q = db.collectionGroup('fcmTokens').limit(Math.min(1000, MAX_TOKENS - count));
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    for (const d of snap.docs) {
      const uid = d.ref.parent.parent?.id;
      const token = d.get('token');
      // Only users/{uid}/fcmTokens/{id}
      if (!uid || d.ref.parent.parent?.parent.id !== 'users' || typeof token !== 'string' || !token) continue;
      const list = byUid.get(uid) ?? [];
      list.push({ ref: d.ref, token });
      byUid.set(uid, list);
    }
    count += snap.size;
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < 1000) break;
  }
  if (count >= MAX_TOKENS) logger.warn(`digest: token cap ${MAX_TOKENS} reached, remaining users skipped this run`);
  return byUid;
}

async function getAllData(db: Firestore, refs: DocumentReference[]): Promise<Map<string, FirebaseFirestore.DocumentData>> {
  const out = new Map<string, FirebaseFirestore.DocumentData>();
  for (const part of chunk(refs, 100)) {
    if (!part.length) continue;
    const snaps = await db.getAll(...part);
    for (const s of snaps) if (s.exists) out.set(s.ref.path, s.data()!);
  }
  return out;
}

/** Sends one message to every token of a user; removes tokens FCM says are gone. */
async function sendToUser(
  messaging: Messaging,
  tokens: TokenRef[],
  msg: PushMessage,
  appUrl: string,
  stats: DigestStats
): Promise<boolean> {
  const link = appUrl.replace(/\/$/, '') + msg.link;
  const res = await messaging.sendEach(
    tokens.map((t) => ({
      token: t.token,
      // Data-only: the service worker (src/firebase-messaging-sw.js) shows it,
      // so title/body/click behave the same in every browser.
      data: { title: msg.title, body: msg.body, link, tag: 'odivon-digest' },
      webpush: { headers: { Urgency: 'normal', TTL: String(12 * 60 * 60) } },
    }))
  );
  let ok = false;
  await Promise.all(
    res.responses.map(async (r, i) => {
      if (r.success) {
        ok = true;
        return;
      }
      const code = r.error?.code;
      if (isDeadTokenError(code)) {
        stats.deadTokens++;
        await tokens[i].ref.delete().catch(() => undefined);
      } else {
        stats.failures++;
        logger.warn('digest: send failed', { code, message: r.error?.message });
      }
    })
  );
  return ok;
}

export interface DigestOptions {
  now?: number;
  appUrl?: string;
  /** For emulator runs: build messages but don't call FCM. */
  dryRun?: boolean;
  onMessage?: (uid: string, msg: PushMessage) => void;
}

export async function runDailyDigest(
  db: Firestore,
  messaging: Messaging | null,
  opts: DigestOptions = {}
): Promise<DigestStats> {
  const now = opts.now ?? Date.now();
  const appUrl = opts.appUrl ?? defaultAppUrl();
  const today = istanbulDayKey(now);
  const stats: DigestStats = { tokens: 0, users: 0, sent: 0, skipped: 0, deadTokens: 0, failures: 0 };

  const tokensByUid = await loadTokens(db);
  stats.tokens = [...tokensByUid.values()].reduce((n, l) => n + l.length, 0);
  if (!tokensByUid.size) return stats;

  const uids = [...tokensByUid.keys()];
  const users = await getAllData(db, uids.map((u) => db.doc(`users/${u}`)));
  const states = await getAllData(db, uids.map((u) => db.doc(`${STATE_COLLECTION}/${u}`)));

  // Who gets a digest today, and from when "new" counts.
  const targets: { user: UserLite; since: number }[] = [];
  for (const uid of uids) {
    const data = users.get(`users/${uid}`);
    if (!data || data.notifyPush === false) {
      stats.skipped++;
      continue;
    }
    const state = states.get(`${STATE_COLLECTION}/${uid}`);
    if (state?.lastDay === today) {
      stats.skipped++; // already sent today (e.g. a retried run)
      continue;
    }
    const lastSent = typeof state?.lastSentAt === 'number' ? state.lastSentAt : 0;
    const since = Math.max(now - DAY, Math.min(lastSent, now));
    targets.push({ user: { ...(data as UserLite), uid }, since });
  }
  stats.users = targets.length;
  if (!targets.length) return stats;

  const windowStart = Math.min(...targets.map((t) => t.since));
  const { end: tomorrowEnd } = tomorrowRange(now);

  // Pool updates of the window (single-field range → automatic index).
  const poolSnap = await db
    .collection('poolUpdates')
    .where('createdAt', '>', windowStart)
    .orderBy('createdAt', 'desc')
    .limit(MAX_POOL_UPDATES)
    .get();
  const poolUpdates = poolSnap.docs.map((d) => d.data() as PoolUpdateLite);

  // Classes the students are in: one read of the class + two small queries each, cached.
  const students = targets.filter((t) => isStudentRole(t.user.role));
  const classIds = new Set<string>();
  for (const t of students) {
    for (const id of (t.user.classIds ?? []).slice(0, MAX_CLASSES_PER_STUDENT)) {
      if (classIds.size < MAX_CLASSES) classIds.add(id);
    }
  }
  const classData = new Map<string, StudentClassData>();
  await mapLimit([...classIds], CONCURRENCY, async (classId) => {
    const cls = await db.doc(`classes/${classId}`).get();
    if (!cls.exists || cls.get('archived') === true) return;
    const col = db.collection(`classes/${classId}/assignments`);
    const [recent, due] = await Promise.all([
      col.where('createdAt', '>', windowStart).limit(50).get(),
      col.where('dueAt', '>=', now).where('dueAt', '<', tomorrowEnd).limit(50).get(),
    ]);
    classData.set(classId, {
      cls: { id: classId, name: String(cls.get('name') ?? 'Sınıf'), archived: false },
      recentAssignments: recent.docs.map((d) => toAssignment(classId, d)),
      dueSoon: due.docs.map((d) => toAssignment(classId, d)),
    });
  });

  const messagingOrNull = opts.dryRun ? null : messaging;

  await mapLimit(targets, CONCURRENCY, async ({ user, since }) => {
    try {
      let msg: PushMessage | null;
      if (isStudentRole(user.role)) {
        const classes = (user.classIds ?? [])
          .slice(0, MAX_CLASSES_PER_STUDENT)
          .map((id) => classData.get(id))
          .filter((c): c is StudentClassData => !!c);
        // Which of the candidate assignments has this student already done?
        const candidates = classes.flatMap((c) => [...c.recentAssignments, ...c.dueSoon]);
        const refs = [...new Map(candidates.map((a) => [assignmentKey(a), a])).values()].map((a) =>
          db.doc(`classes/${a.classId}/assignments/${a.id}/submissions/${user.uid}`)
        );
        const subs = await getAllData(db, refs);
        const submitted = new Set(
          [...subs.keys()].map((path) => {
            const p = path.split('/');
            return `${p[1]}/${p[3]}`;
          })
        );
        msg = buildStudentDigest({ user, now, since, poolUpdates, classes, submitted });
      } else {
        msg = buildTeacherDigest(await loadTeacherDay(db, user.uid, since, now));
      }

      if (!msg) {
        stats.skipped++;
        return;
      }
      opts.onMessage?.(user.uid, msg);
      if (!messagingOrNull) {
        stats.sent++;
        return;
      }
      const ok = await sendToUser(messagingOrNull, tokensByUid.get(user.uid)!, msg, appUrl, stats);
      if (ok) {
        stats.sent++;
        await db.doc(`${STATE_COLLECTION}/${user.uid}`).set({ lastSentAt: now, lastDay: today }, { merge: true });
      }
    } catch (err) {
      stats.failures++;
      logger.error('digest: user failed', { uid: user.uid, err: String(err) });
    }
  });

  return stats;
}

/** A teacher's day: assignments that closed since the last digest and new joiners. */
async function loadTeacherDay(db: Firestore, uid: string, since: number, now: number): Promise<TeacherClassDay[]> {
  const classes = await db.collection('classes').where('teacherId', '==', uid).limit(30).get();
  const out: TeacherClassDay[] = [];
  for (const c of classes.docs) {
    if (c.get('archived') === true) continue;
    const cls: ClassLite = { id: c.id, name: String(c.get('name') ?? 'Sınıf') };
    const [closedSnap, membersCount, newMembers] = await Promise.all([
      c.ref.collection('assignments').where('dueAt', '>', since).where('dueAt', '<=', now).limit(10).get(),
      c.ref.collection('members').count().get(),
      c.ref.collection('members').where('joinedAt', '>', since).count().get(),
    ]);
    const members = membersCount.data().count;
    const closed = await Promise.all(
      closedSnap.docs.map(async (d) => ({
        a: toAssignment(c.id, d),
        submitted: (await d.ref.collection('submissions').count().get()).data().count,
        members,
      }))
    );
    out.push({ cls, newMembers: newMembers.data().count, closed: members > 0 ? closed : [] });
  }
  return out;
}

/**
 * Daily at 18:00 (Türkiye): at most one push per user summarising what's new.
 * Needs the Blaze plan (Cloud Scheduler) – see functions/README.md.
 */
export const dailyDigest = onSchedule(
  {
    schedule: '0 18 * * *',
    timeZone: 'Europe/Istanbul',
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async () => {
    const stats = await runDailyDigest(admin.firestore(), admin.messaging());
    logger.info('dailyDigest done', stats);
  }
);
