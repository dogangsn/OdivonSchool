import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';
import type { Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import {
  AssignmentLite,
  ClassLite,
  DAY,
  EmailMessage,
  MemberLite,
  ProgressLite,
  UserLite,
  WeeklyClassReport,
  buildTeacherWeeklyEmail,
  buildWeeklyClassReport,
  chunk,
  defaultAppUrl,
  isDeliverableEmail,
  istanbulWeekKey,
  mapLimit,
} from './notifyLogic';

const MAX_CLASSES = 2000;
const MAX_CLASSES_PER_TEACHER = 30;
const MAX_MEMBERS = 300;
/** Overdue = due in the last 30 days and not handed in; older ones are history. */
const OVERDUE_WINDOW = 30 * DAY;
const MAX_OVERDUE_ASSIGNMENTS = 20;
const CONCURRENCY = 10;
/** Collection watched by the "Trigger Email from Firestore" extension. */
export const MAIL_COLLECTION = 'mail';

export interface WeeklyStats {
  classes: number;
  teachers: number;
  queued: number;
  skipped: number;
  failures: number;
}

export interface WeeklyOptions {
  now?: number;
  appUrl?: string;
  dryRun?: boolean;
  onEmail?: (teacherUid: string, to: string, msg: EmailMessage) => void;
}

async function loadClasses(db: Firestore): Promise<Map<string, ClassLite[]>> {
  const byTeacher = new Map<string, ClassLite[]>();
  let last: QueryDocumentSnapshot | undefined;
  let count = 0;
  while (count < MAX_CLASSES) {
    let q = db.collection('classes').orderBy(admin.firestore.FieldPath.documentId()).limit(500);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    for (const d of snap.docs) {
      const teacherId = d.get('teacherId');
      if (typeof teacherId !== 'string' || d.get('archived') === true) continue;
      const list = byTeacher.get(teacherId) ?? [];
      if (list.length < MAX_CLASSES_PER_TEACHER) list.push({ id: d.id, name: String(d.get('name') ?? 'Sınıf'), teacherId });
      byTeacher.set(teacherId, list);
    }
    count += snap.size;
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < 500) break;
  }
  if (count >= MAX_CLASSES) logger.warn(`teacherWeekly: class cap ${MAX_CLASSES} reached`);
  return byTeacher;
}

async function classReport(db: Firestore, cls: ClassLite, now: number): Promise<WeeklyClassReport> {
  const base = db.doc(`classes/${cls.id}`);
  const [membersSnap, progressSnap, dueSnap] = await Promise.all([
    base.collection('members').limit(MAX_MEMBERS).get(),
    base.collection('progress').limit(MAX_MEMBERS).get(),
    base
      .collection('assignments')
      .where('dueAt', '>=', now - OVERDUE_WINDOW)
      .where('dueAt', '<', now)
      .orderBy('dueAt', 'desc')
      .limit(MAX_OVERDUE_ASSIGNMENTS)
      .get(),
  ]);
  const members: MemberLite[] = membersSnap.docs.map((d) => ({
    uid: d.id,
    displayName: d.get('displayName'),
    joinedAt: d.get('joinedAt'),
  }));
  const progress: ProgressLite[] = progressSnap.docs.map((d) => ({ ...(d.data() as ProgressLite), uid: d.id }));
  const pastDue: AssignmentLite[] = dueSnap.docs.map((d) => ({
    id: d.id,
    classId: cls.id,
    title: String(d.get('title') ?? 'Ödev'),
    dueAt: d.get('dueAt'),
    createdAt: d.get('createdAt') ?? 0,
  }));
  const submissions: Record<string, string[]> = {};
  await Promise.all(
    dueSnap.docs.map(async (d) => {
      // Only the ids are needed: select() with no fields keeps the payload tiny.
      const subs = await d.ref.collection('submissions').select().limit(MAX_MEMBERS).get();
      submissions[d.id] = subs.docs.map((s) => s.id);
    })
  );
  return buildWeeklyClassReport({ cls, members, progress, pastDue, submissions, now });
}

export async function runTeacherWeekly(db: Firestore, opts: WeeklyOptions = {}): Promise<WeeklyStats> {
  const now = opts.now ?? Date.now();
  const appUrl = opts.appUrl ?? defaultAppUrl();
  const week = istanbulWeekKey(now);
  const stats: WeeklyStats = { classes: 0, teachers: 0, queued: 0, skipped: 0, failures: 0 };

  const byTeacher = await loadClasses(db);
  const teacherIds = [...byTeacher.keys()];
  const teachers = new Map<string, UserLite>();
  for (const part of chunk(teacherIds, 100)) {
    const snaps = await db.getAll(...part.map((id) => db.doc(`users/${id}`)));
    for (const s of snaps) if (s.exists) teachers.set(s.id, { ...(s.data() as UserLite), uid: s.id });
  }

  const eligible = teacherIds.filter((id) => {
    const t = teachers.get(id);
    const ok = !!t && isDeliverableEmail(t);
    if (!ok) stats.skipped++;
    return ok;
  });
  stats.teachers = eligible.length;

  await mapLimit(eligible, CONCURRENCY, async (teacherId) => {
    const teacher = teachers.get(teacherId)!;
    try {
      const classes = byTeacher.get(teacherId) ?? [];
      const reports: WeeklyClassReport[] = [];
      for (const cls of classes) {
        reports.push(await classReport(db, cls, now));
        stats.classes++;
      }
      const msg = buildTeacherWeeklyEmail(teacher.displayName ?? '', reports, now, appUrl);
      if (!msg) {
        stats.skipped++;
        return;
      }
      const to = teacher.email!.trim();
      opts.onEmail?.(teacherId, to, msg);
      if (opts.dryRun) {
        stats.queued++;
        return;
      }
      // Deterministic id: a retried run cannot e-mail the same teacher twice in a week.
      await db.doc(`${MAIL_COLLECTION}/weekly_${teacherId}_${week}`).create({
        to,
        message: msg,
        kind: 'teacherWeekly',
        uid: teacherId,
        createdAt: now,
      });
      stats.queued++;
    } catch (err: unknown) {
      if ((err as { code?: number }).code === 6) {
        stats.skipped++; // ALREADY_EXISTS: queued earlier this week
        return;
      }
      stats.failures++;
      logger.error('teacherWeekly: teacher failed', { teacherId, err: String(err) });
    }
  });
  return stats;
}

/**
 * Sundays 19:00 (Türkiye): one summary e-mail per teacher, queued in `mail`
 * for the "Trigger Email from Firestore" extension. Needs the Blaze plan.
 */
export const teacherWeeklyEmail = onSchedule(
  {
    schedule: '0 19 * * 0',
    timeZone: 'Europe/Istanbul',
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async () => {
    const stats = await runTeacherWeekly(admin.firestore());
    logger.info('teacherWeeklyEmail done', stats);
  }
);
