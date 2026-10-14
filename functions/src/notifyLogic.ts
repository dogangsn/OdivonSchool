/**
 * Pure helpers for the daily push digest and the weekly teacher e-mail.
 * Nothing in this file touches Firebase, so it can be unit-tested with
 * `node --test` (see notifyLogic.test.ts).
 *
 * Several helpers are ports of client code that cannot be imported here
 * (functions/ compiles only its own src/):
 *  - poolUpdatesForUser  ← src/app/core/services/notifications.ts (updatesForUser + level query)
 *  - weakTopicsFrom      ← src/app/core/tracking.ts (buildTracking → weakTopics)
 *  - isDeliverableEmail  ← src/app/core/student-accounts.ts (STUDENT_EMAIL_DOMAIN)
 */

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;
/** Türkiye has used a fixed UTC+3 offset (no DST) since 2016. */
export const ISTANBUL_OFFSET_MS = 3 * HOUR;

export const INACTIVE_DAYS = 7;
export const WEAK_TOPIC = 70;
export const MIN_ANSWERS_FOR_FLAG = 10;
/** Teacher-created student accounts sign in with a username mapped to this domain. */
export const STUDENT_EMAIL_DOMAIN = 'ogrenci.odivonschool.firebaseapp.com';

// ---------------------------------------------------------------------------
// Minimal shapes (mirroring src/app/models/*, only the fields we read)
// ---------------------------------------------------------------------------

export interface PoolUpdateLite {
  level: string;
  grades?: number[];
  categoryId?: string;
  subject: string;
  topic: string;
  count: number;
  createdAt: number;
}

export interface UserLite {
  uid: string;
  email?: string;
  displayName?: string;
  role?: string;
  gradeLevel?: string;
  grade?: number | null;
  classIds?: string[];
  notifyPush?: boolean;
  notifyEmail?: boolean;
  createdByTeacher?: string;
}

export interface ClassLite {
  id: string;
  name: string;
  teacherId?: string;
  archived?: boolean;
}

export interface AssignmentLite {
  id: string;
  classId: string;
  title: string;
  subject?: string;
  dueAt: number | null;
  createdAt: number;
}

export interface MemberLite {
  uid: string;
  displayName?: string;
  joinedAt?: number;
}

export interface TopicStatLite {
  label: string;
  subject: string;
  correct: number;
  total: number;
}

export interface ProgressLite {
  uid: string;
  displayName?: string;
  lastActiveAt?: number;
  answered?: number;
  correct?: number;
  topics?: Record<string, TopicStatLite>;
}

export interface PushMessage {
  title: string;
  body: string;
  /** App path the notification opens, e.g. "/panel/anasayfa". */
  link: string;
}

// ---------------------------------------------------------------------------
// Time helpers (Europe/Istanbul)
// ---------------------------------------------------------------------------

/** UTC ms of 00:00 Istanbul time on the day that contains `ts`. */
export function istanbulDayStart(ts: number): number {
  return Math.floor((ts + ISTANBUL_OFFSET_MS) / DAY) * DAY - ISTANBUL_OFFSET_MS;
}

/** "YYYY-MM-DD" of `ts` in Istanbul. */
export function istanbulDayKey(ts: number): string {
  return new Date(ts + ISTANBUL_OFFSET_MS).toISOString().slice(0, 10);
}

/** [start, end) of tomorrow (Istanbul) relative to `now`. */
export function tomorrowRange(now: number): { start: number; end: number } {
  const start = istanbulDayStart(now) + DAY;
  return { start, end: start + DAY };
}

/** ISO-8601 week id of `ts` in Istanbul, e.g. "2026-W42". */
export function istanbulWeekKey(ts: number): string {
  const d = new Date(istanbulDayStart(ts) + ISTANBUL_OFFSET_MS); // midnight, read as UTC fields
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow + 3); // Thursday of this week decides the year
  const year = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = (jan4.getUTCDay() + 6) % 7;
  const week1Thursday = Date.UTC(year, 0, 4 - jan4Dow + 3);
  const week = Math.round((d.getTime() - week1Thursday) / (7 * DAY)) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** "14.10.2026" in Istanbul. */
export function formatDayTr(ts: number): string {
  const [y, m, d] = istanbulDayKey(ts).split('-');
  return `${d}.${m}.${y}`;
}

/** Public site address used in e-mails and notification links. */
export function defaultAppUrl(env: Record<string, string | undefined> = process.env): string {
  const project = env.GCLOUD_PROJECT || env.GCP_PROJECT || 'odivonschool';
  return env.APP_URL || `https://${project}.web.app`;
}

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Runs `fn` over `items` with at most `limit` in flight; keeps input order. */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncate(text: string, max: number): string {
  const t = (text || '').trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}

function quote(title: string): string {
  return `“${truncate(title, 40)}”`;
}

export function percent(correct: number, total: number): number | null {
  return total > 0 ? Math.round((correct / total) * 100) : null;
}

export function isStudentRole(role: string | undefined): boolean {
  return !role || role === 'student' || role === 'user';
}

/** FCM errors after which a token will never work again. */
export function isDeadTokenError(code: string | undefined): boolean {
  return (
    code === 'messaging/registration-token-not-registered' ||
    code === 'messaging/invalid-registration-token'
  );
}

/**
 * A real inbox we may e-mail: has a plausible address, is not one of the
 * username accounts a teacher opened for a student, and the user did not
 * turn e-mail off.
 */
export function isDeliverableEmail(user: Pick<UserLite, 'email' | 'createdByTeacher' | 'notifyEmail'>): boolean {
  if (user.notifyEmail === false) return false;
  if (user.createdByTeacher) return false;
  const email = (user.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  const domain = email.slice(email.lastIndexOf('@') + 1);
  if (domain === STUDENT_EMAIL_DOMAIN || domain.endsWith('.' + STUDENT_EMAIL_DOMAIN)) return false;
  if (domain.endsWith('.invalid') || domain.endsWith('.local') || domain === 'example.com') return false;
  return true;
}

// ---------------------------------------------------------------------------
// Student daily digest
// ---------------------------------------------------------------------------

/**
 * Pool updates that concern this student: same level as the bell query
 * (`where level == gradeLevel`) plus the sınıf filter of updatesForUser,
 * newer than `since`.
 */
export function poolUpdatesForUser(
  updates: readonly PoolUpdateLite[],
  user: Pick<UserLite, 'gradeLevel' | 'grade'>,
  since: number
): PoolUpdateLite[] {
  if (!user.gradeLevel) return [];
  const grade = user.grade;
  return updates.filter(
    (u) =>
      u.level === user.gradeLevel &&
      u.createdAt > since &&
      (!grade || !u.grades?.length || u.grades.includes(grade))
  );
}

export interface StudentClassData {
  cls: ClassLite;
  /** Assignments of this class created recently (the caller's window). */
  recentAssignments: AssignmentLite[];
  /** Assignments of this class due between now and the end of tomorrow. */
  dueSoon: AssignmentLite[];
}

export interface StudentDigestInput {
  user: UserLite;
  now: number;
  /** Only things newer than this count as "new". */
  since: number;
  poolUpdates: readonly PoolUpdateLite[];
  classes: StudentClassData[];
  /** `${classId}/${assignmentId}` keys this student already submitted. */
  submitted: ReadonlySet<string>;
}

export interface StudentDigestItems {
  newQuestions: number;
  topics: { subject: string; topic: string; count: number }[];
  newAssignments: { a: AssignmentLite; className: string }[];
  dueToday: { a: AssignmentLite; className: string }[];
  dueTomorrow: { a: AssignmentLite; className: string }[];
}

export function assignmentKey(a: Pick<AssignmentLite, 'classId' | 'id'>): string {
  return `${a.classId}/${a.id}`;
}

export function selectStudentDigest(input: StudentDigestInput): StudentDigestItems {
  const { now, since, submitted } = input;
  const { start: tomorrowStart, end: tomorrowEnd } = tomorrowRange(now);
  const memberOf = new Set(input.user.classIds ?? []);

  const dueToday: StudentDigestItems['dueToday'] = [];
  const dueTomorrow: StudentDigestItems['dueTomorrow'] = [];
  const newAssignments: StudentDigestItems['newAssignments'] = [];
  const seen = new Set<string>();

  for (const { cls, dueSoon } of input.classes) {
    if (cls.archived || !memberOf.has(cls.id)) continue;
    for (const a of dueSoon) {
      const key = assignmentKey(a);
      if (seen.has(key) || submitted.has(key) || a.dueAt === null) continue;
      if (a.dueAt >= now && a.dueAt < tomorrowStart) dueToday.push({ a, className: cls.name });
      else if (a.dueAt >= tomorrowStart && a.dueAt < tomorrowEnd) dueTomorrow.push({ a, className: cls.name });
      else continue;
      seen.add(key);
    }
  }
  for (const { cls, recentAssignments } of input.classes) {
    if (cls.archived || !memberOf.has(cls.id)) continue;
    for (const a of recentAssignments) {
      const key = assignmentKey(a);
      if (seen.has(key) || submitted.has(key) || a.createdAt <= since) continue;
      if (a.dueAt !== null && a.dueAt < now) continue; // already overdue: not "new" news
      newAssignments.push({ a, className: cls.name });
      seen.add(key);
    }
  }

  const byTopic = new Map<string, { subject: string; topic: string; count: number }>();
  let newQuestions = 0;
  for (const u of poolUpdatesForUser(input.poolUpdates, input.user, since)) {
    const count = Math.max(0, Number(u.count) || 0);
    if (!count) continue;
    newQuestions += count;
    const key = u.categoryId || `${u.subject}|${u.topic}`;
    const t = byTopic.get(key) ?? { subject: u.subject, topic: u.topic, count: 0 };
    t.count += count;
    byTopic.set(key, t);
  }
  const topics = [...byTopic.values()].sort((a, b) => b.count - a.count);

  const byDue = (x: { a: AssignmentLite }, y: { a: AssignmentLite }) => (x.a.dueAt ?? 0) - (y.a.dueAt ?? 0);
  dueToday.sort(byDue);
  dueTomorrow.sort(byDue);
  newAssignments.sort((x, y) => y.a.createdAt - x.a.createdAt);
  return { newQuestions, topics, newAssignments, dueToday, dueTomorrow };
}

function assignmentLine(
  icon: string,
  label: string,
  items: { a: AssignmentLite; className: string }[]
): string {
  if (items.length === 1) {
    const { a, className } = items[0];
    return `${icon} ${label}: ${quote(a.title)} (${truncate(className, 20)})`;
  }
  const names = items.slice(0, 2).map((i) => quote(i.a.title)).join(', ');
  const more = items.length > 2 ? ` +${items.length - 2}` : '';
  return `${icon} ${items.length} ödev ${label.toLocaleLowerCase('tr')}: ${names}${more}`;
}

/** Turns the selected items into one notification, or null when there is nothing to say. */
export function formatStudentDigest(items: StudentDigestItems): PushMessage | null {
  const lines: string[] = [];
  if (items.dueToday.length) lines.push(assignmentLine('⏰', 'Bugün teslim', items.dueToday));
  if (items.dueTomorrow.length) lines.push(assignmentLine('⏰', 'Yarın teslim', items.dueTomorrow));
  if (items.newAssignments.length) {
    lines.push(
      items.newAssignments.length === 1
        ? assignmentLine('📝', 'Yeni ödev', items.newAssignments)
        : `📝 ${items.newAssignments.length} yeni ödev: ${items.newAssignments
            .slice(0, 2)
            .map((i) => quote(i.a.title))
            .join(', ')}${items.newAssignments.length > 2 ? ` +${items.newAssignments.length - 2}` : ''}`
    );
  }
  if (items.newQuestions > 0) {
    const topicNames = items.topics.slice(0, 2).map((t) => truncate(t.topic, 30));
    const more = items.topics.length > 2 ? ` ve ${items.topics.length - 2} konu daha` : '';
    lines.push(`📚 Havuza ${items.newQuestions} yeni soru: ${topicNames.join(', ')}${more}`);
  }
  if (!lines.length) return null;

  const urgent = [...items.dueToday, ...items.dueTomorrow];
  let link = '/panel/kategoriler';
  if (urgent.length === 1 && !items.newAssignments.length) link = `/odev/${urgent[0].a.classId}/${urgent[0].a.id}`;
  else if (urgent.length || items.newAssignments.length) link = '/panel/anasayfa';

  const title = urgent.length ? 'Teslim tarihi yaklaşan ödevin var' : 'Bugün senin için yenilikler var';
  return { title, body: lines.join('\n'), link };
}

export function buildStudentDigest(input: StudentDigestInput): PushMessage | null {
  return formatStudentDigest(selectStudentDigest(input));
}

// ---------------------------------------------------------------------------
// Teacher daily digest (push)
// ---------------------------------------------------------------------------

export interface TeacherClassDay {
  cls: ClassLite;
  newMembers: number;
  /** Assignments whose due time passed since the last digest. */
  closed: { a: AssignmentLite; submitted: number; members: number }[];
}

export function buildTeacherDigest(classes: TeacherClassDay[]): PushMessage | null {
  const lines: string[] = [];
  for (const { cls, closed } of classes) {
    if (cls.archived) continue;
    for (const c of closed) {
      lines.push(
        `📋 ${quote(c.a.title)} (${truncate(cls.name, 20)}) süresi doldu: ${c.submitted}/${c.members} öğrenci teslim etti`
      );
    }
  }
  const joined = classes.filter((c) => !c.cls.archived && c.newMembers > 0);
  for (const c of joined) {
    lines.push(`👋 ${truncate(c.cls.name, 20)} sınıfına ${c.newMembers} yeni öğrenci katıldı`);
  }
  if (!lines.length) return null;
  const shown = lines.slice(0, 4);
  if (lines.length > 4) shown.push(`…ve ${lines.length - 4} gelişme daha`);
  return { title: 'Sınıflarınızda bugün', body: shown.join('\n'), link: '/ogretmen' };
}

// ---------------------------------------------------------------------------
// Weekly teacher e-mail
// ---------------------------------------------------------------------------

export interface WeakTopic {
  key: string;
  label: string;
  subject: string;
  pct: number;
  total: number;
}

/** Same rule as buildTracking().weakTopics: ≥10 answers, under 70 %, worst 3. */
export function weakTopicsFrom(progress: readonly ProgressLite[], memberIds?: ReadonlySet<string>): WeakTopic[] {
  const totals = new Map<string, { label: string; subject: string; correct: number; total: number }>();
  for (const p of progress) {
    if (memberIds && !memberIds.has(p.uid)) continue;
    for (const [key, t] of Object.entries(p.topics ?? {})) {
      if (!t || !(t.total > 0)) continue;
      const col = totals.get(key) ?? { label: t.label, subject: t.subject, correct: 0, total: 0 };
      col.correct += t.correct || 0;
      col.total += t.total;
      totals.set(key, col);
    }
  }
  return [...totals.entries()]
    .map(([key, c]) => ({ key, label: c.label, subject: c.subject, total: c.total, pct: percent(c.correct, c.total) }))
    .filter((c): c is WeakTopic => c.total >= MIN_ANSWERS_FOR_FLAG && c.pct !== null && c.pct < WEAK_TOPIC)
    .sort((a, b) => a.pct - b.pct || b.total - a.total)
    .slice(0, 3);
}

export interface WeeklyClassInput {
  cls: ClassLite;
  members: MemberLite[];
  progress: ProgressLite[];
  /** Assignments whose due date has passed (the caller limits how far back). */
  pastDue: AssignmentLite[];
  /** Submitter uids by assignment id. */
  submissions: Record<string, string[]>;
  now: number;
}

export interface WeeklyClassReport {
  classId: string;
  className: string;
  students: number;
  activeThisWeek: number;
  inactive: { name: string; days: number | null }[];
  overdueAssignments: { title: string; missing: number; dueAt: number }[];
  missingSubmissions: number;
  weakTopics: WeakTopic[];
  avgSuccess: number | null;
}

export function buildWeeklyClassReport(input: WeeklyClassInput): WeeklyClassReport {
  const { members, now } = input;
  const memberIds = new Set(members.map((m) => m.uid));
  const progressByUid = new Map(input.progress.filter((p) => memberIds.has(p.uid)).map((p) => [p.uid, p]));
  const weekAgo = now - INACTIVE_DAYS * DAY;

  let activeThisWeek = 0;
  const inactive: WeeklyClassReport['inactive'] = [];
  for (const m of members) {
    const p = progressByUid.get(m.uid);
    const last = p?.lastActiveAt ?? null;
    const name = p?.displayName || m.displayName || 'Öğrenci';
    if (last && last >= weekAgo) activeThisWeek++;
    else inactive.push({ name, days: last ? Math.floor((now - last) / DAY) : null });
  }
  const collator = new Intl.Collator('tr');
  // Never-started students first, then the longest inactive.
  inactive.sort((a, b) => (b.days ?? Infinity) - (a.days ?? Infinity) || collator.compare(a.name, b.name));

  const overdueAssignments: WeeklyClassReport['overdueAssignments'] = [];
  let missingSubmissions = 0;
  for (const a of input.pastDue) {
    if (a.dueAt === null || a.dueAt >= now) continue;
    const done = new Set((input.submissions[a.id] ?? []).filter((u) => memberIds.has(u)));
    const missing = members.length - done.size;
    if (missing > 0) {
      overdueAssignments.push({ title: a.title, missing, dueAt: a.dueAt });
      missingSubmissions += missing;
    }
  }
  overdueAssignments.sort((a, b) => b.dueAt - a.dueAt);

  let answered = 0;
  let correct = 0;
  for (const p of progressByUid.values()) {
    answered += p.answered ?? 0;
    correct += p.correct ?? 0;
  }

  return {
    classId: input.cls.id,
    className: input.cls.name,
    students: members.length,
    activeThisWeek,
    inactive,
    overdueAssignments,
    missingSubmissions,
    weakTopics: weakTopicsFrom([...progressByUid.values()]),
    avgSuccess: percent(correct, answered),
  };
}

export interface EmailMessage {
  subject: string;
  html: string;
  text: string;
}

const MAX_NAMES = 10;

function inactiveText(i: { name: string; days: number | null }): string {
  return i.days === null ? `${i.name} (hiç başlamadı)` : `${i.name} (${i.days} gündür)`;
}

function topicText(t: WeakTopic): string {
  return `${t.subject ? t.subject + ' – ' : ''}${t.label} (%${t.pct}, ${t.total} cevap)`;
}

/** The weekly summary e-mail for one teacher; null when no class has students. */
export function buildTeacherWeeklyEmail(
  teacherName: string,
  reports: WeeklyClassReport[],
  now: number,
  appUrl: string
): EmailMessage | null {
  const withStudents = reports.filter((r) => r.students > 0);
  if (!withStudents.length) return null;
  const collator = new Intl.Collator('tr');
  withStudents.sort((a, b) => collator.compare(a.className, b.className));

  const from = formatDayTr(now - 6 * DAY);
  const to = formatDayTr(now);
  const subject = `Haftalık sınıf özeti (${from} – ${to})`;
  const greeting = `Merhaba ${teacherName || 'Öğretmenim'},`;
  const intro = 'Odivon School sınıflarınızın bu haftaki durumu aşağıda.';
  const link = `${appUrl.replace(/\/$/, '')}/ogretmen`;

  const textParts: string[] = [greeting, '', intro, ''];
  const htmlParts: string[] = [
    `<div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;max-width:640px;margin:0 auto;line-height:1.5">`,
    `<p>${escapeHtml(greeting)}</p>`,
    `<p>${escapeHtml(intro)}</p>`,
  ];

  for (const r of withStudents) {
    const names = r.inactive.slice(0, MAX_NAMES).map(inactiveText);
    const moreNames = r.inactive.length > MAX_NAMES ? r.inactive.length - MAX_NAMES : 0;
    const overdueLine = r.overdueAssignments.length
      ? `${r.overdueAssignments.length} ödev (${r.missingSubmissions} eksik teslim)`
      : 'Yok';
    const weakLine = r.weakTopics.length ? r.weakTopics.map(topicText).join('; ') : 'Belirgin zayıf konu yok';

    textParts.push(
      `■ ${r.className} (${r.students} öğrenci)`,
      `  Bu hafta aktif: ${r.activeThisWeek}/${r.students}`,
      `  7+ gündür etkinlik yok: ${r.inactive.length}${names.length ? ' – ' + names.join(', ') : ''}${moreNames ? ` ve ${moreNames} kişi daha` : ''}`,
      `  Süresi geçen ödevler: ${overdueLine}`,
      ...r.overdueAssignments.slice(0, 5).map((o) => `    • ${o.title}: ${o.missing} öğrenci teslim etmedi`),
      `  Zayıf konular: ${weakLine}`,
      `  Ortalama başarı: ${r.avgSuccess === null ? '–' : '%' + r.avgSuccess}`,
      ''
    );

    const row = (label: string, value: string) =>
      `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:4px 0">${value}</td></tr>`;
    htmlParts.push(
      `<div style="border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin:16px 0">`,
      `<h3 style="margin:0 0 8px;font-size:17px">${escapeHtml(r.className)} <span style="color:#6b7280;font-weight:normal">(${r.students} öğrenci)</span></h3>`,
      `<table style="border-collapse:collapse;font-size:14px">`,
      row('Bu hafta aktif', `<strong>${r.activeThisWeek}</strong> / ${r.students}`),
      row(
        '7+ gündür etkinlik yok',
        `<strong>${r.inactive.length}</strong>${names.length ? '<br>' + escapeHtml(names.join(', ')) : ''}${moreNames ? escapeHtml(` ve ${moreNames} kişi daha`) : ''}`
      ),
      row(
        'Süresi geçen ödevler',
        escapeHtml(overdueLine) +
          (r.overdueAssignments.length
            ? '<br>' +
              r.overdueAssignments
                .slice(0, 5)
                .map((o) => `• ${escapeHtml(o.title)}: ${o.missing} öğrenci teslim etmedi`)
                .join('<br>')
            : '')
      ),
      row('Zayıf konular', escapeHtml(weakLine)),
      row('Ortalama başarı', r.avgSuccess === null ? '–' : `%${r.avgSuccess}`),
      `</table></div>`
    );
  }

  const footer = 'Bu e-postayı istemiyorsanız Profil → Bildirim ayarları bölümünden "E-posta özetleri"ni kapatabilirsiniz.';
  textParts.push(`Ayrıntılar: ${link}`, '', footer);
  htmlParts.push(
    `<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px">Öğretmen panelini aç</a></p>`,
    `<p style="font-size:12px;color:#6b7280">${escapeHtml(footer)}</p>`,
    `</div>`
  );

  return { subject, html: htmlParts.join('\n'), text: textParts.join('\n') };
}
