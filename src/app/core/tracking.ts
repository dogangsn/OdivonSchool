import { GameOutcome } from '../games/game-models';
import {
  Assignment,
  ClassMember,
  ClassProgress,
  ProgressEntry,
  Submission,
} from '../models/classroom';

const DAY = 24 * 60 * 60 * 1000;
export const INACTIVE_DAYS = 7;
/** Below this success rate (with enough answers) a student or topic is flagged. */
export const LOW_SUCCESS = 50;
export const WEAK_TOPIC = 70;
const MIN_ANSWERS_FOR_FLAG = 10;

export type MasteryLevel = 'none' | 'low' | 'mid' | 'high';
export type StudentFlag = 'never' | 'inactive' | 'low' | 'overdue';

export interface TopicCell {
  pct: number | null;
  total: number;
}

export interface StudentRow {
  uid: string;
  name: string;
  lastActiveAt: number | null;
  daysInactive: number | null;
  answered: number;
  successPct: number | null;
  streak: number;
  done: number;
  overdue: number;
  pending: number;
  flags: StudentFlag[];
  topics: Record<string, TopicCell>;
}

export interface TopicColumn {
  key: string;
  label: string;
  subject: string;
  correct: number;
  total: number;
  pct: number | null;
  students: number;
}

export interface HardQuestion {
  prompt: string;
  correctAnswer: string;
  misses: number;
  assignmentTitle: string;
}

export interface ClassTracking {
  summary: {
    students: number;
    active7: number;
    assignments: number;
    submissionRate: number | null;
    avgSuccess: number | null;
  };
  rows: StudentRow[];
  columns: TopicColumn[];
  weakTopics: TopicColumn[];
  hardest: HardQuestion[];
}

export interface TrackingInput {
  members: ClassMember[];
  progress: ClassProgress[];
  assignments: Assignment[];
  /** Submissions by assignment id. */
  submissions: Record<string, Submission[]>;
  now: number;
  maxColumns?: number;
}

export function percent(correct: number, total: number): number | null {
  return total > 0 ? Math.round((correct / total) * 100) : null;
}

export function masteryLevel(pct: number | null): MasteryLevel {
  if (pct === null) return 'none';
  if (pct < LOW_SUCCESS) return 'low';
  if (pct < 75) return 'mid';
  return 'high';
}

/** Whole calendar days between two timestamps, in local time. */
export function calendarDaysBetween(from: number, to: number): number {
  const a = new Date(from);
  a.setHours(0, 0, 0, 0);
  const b = new Date(to);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / DAY);
}

function safeKey(raw: string): string {
  return raw.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);
}

/** Text after the "Game · " prefix games put in their titles. */
function stripGamePrefix(title: string): string {
  const i = title.indexOf(' · ');
  return i >= 0 ? title.slice(i + 3) : title;
}

/** Pool topics share one key between tests and quiz games: `cat_<categoryId>`. */
export function categoryEntry(
  categoryId: string,
  topic: string,
  subject: string,
  correct: number,
  total: number
): ProgressEntry {
  return { key: safeKey(`cat_${categoryId}`), label: topic, subject, correct, total };
}

export function entryFromOutcome(o: GameOutcome): ProgressEntry {
  if (o.categoryId) {
    let label = stripGamePrefix(o.title);
    const dash = label.indexOf(' – ');
    if (dash >= 0) label = label.slice(dash + 3);
    return categoryEntry(o.categoryId, label, o.subject, o.correct, o.total);
  }
  if (o.gameType === 'reading') {
    // One column for every passage; a reading weighs like a 10-question
    // activity (accuracy in tenths) so word counts don't swamp test results.
    const correct = o.total > 0 ? Math.round((o.correct / o.total) * 10) : 0;
    return { key: 'reading', label: 'Sesli okuma', subject: o.subject, correct, total: 10 };
  }
  return {
    key: safeKey(`${o.gameType}_${o.gameKey}`),
    label: stripGamePrefix(o.title),
    subject: o.subject,
    correct: o.correct,
    total: o.total,
  };
}

const collator = new Intl.Collator('tr');

export function buildTracking(input: TrackingInput): ClassTracking {
  const { members, assignments, submissions, now } = input;
  const maxColumns = input.maxColumns ?? 16;
  const memberIds = new Set(members.map((m) => m.uid));
  const progressByUid = new Map(
    input.progress.filter((p) => memberIds.has(p.uid)).map((p) => [p.uid, p])
  );
  const doneBy = new Map<string, Set<string>>(); // assignment id -> uids
  for (const a of assignments) {
    doneBy.set(a.id, new Set((submissions[a.id] ?? []).map((s) => s.uid).filter((u) => memberIds.has(u))));
  }

  // Topic columns: class-wide totals, the most practised ones first.
  const topicTotals = new Map<string, TopicColumn>();
  for (const p of progressByUid.values()) {
    for (const [key, t] of Object.entries(p.topics ?? {})) {
      if (!t || !(t.total > 0)) continue;
      const col = topicTotals.get(key) ?? {
        key,
        label: t.label,
        subject: t.subject,
        correct: 0,
        total: 0,
        pct: null,
        students: 0,
      };
      col.correct += t.correct;
      col.total += t.total;
      col.students += 1;
      topicTotals.set(key, col);
    }
  }
  const allColumns = [...topicTotals.values()].map((c) => ({ ...c, pct: percent(c.correct, c.total) }));
  const columns = [...allColumns]
    .sort((a, b) => b.total - a.total)
    .slice(0, maxColumns)
    .sort((a, b) => collator.compare(a.subject, b.subject) || collator.compare(a.label, b.label));
  const weakTopics = allColumns
    .filter((c) => c.total >= MIN_ANSWERS_FOR_FLAG && c.pct !== null && c.pct < WEAK_TOPIC)
    .sort((a, b) => a.pct! - b.pct! || b.total - a.total)
    .slice(0, 3);

  const rows: StudentRow[] = members.map((m) => {
    const p = progressByUid.get(m.uid);
    let done = 0;
    let overdue = 0;
    let pending = 0;
    for (const a of assignments) {
      if (doneBy.get(a.id)?.has(m.uid)) done++;
      else if (a.dueAt && a.dueAt < now) overdue++;
      else pending++;
    }
    const lastActiveAt = p?.lastActiveAt ?? null;
    const daysInactive = lastActiveAt ? Math.floor((now - lastActiveAt) / DAY) : null;
    const answered = p?.answered ?? 0;
    const successPct = percent(p?.correct ?? 0, answered);
    const streak = lastActiveAt && calendarDaysBetween(lastActiveAt, now) <= 1 ? (p?.streakDays ?? 0) : 0;

    const flags: StudentFlag[] = [];
    if (!p) flags.push('never');
    else if (daysInactive !== null && daysInactive >= INACTIVE_DAYS) flags.push('inactive');
    if (successPct !== null && answered >= MIN_ANSWERS_FOR_FLAG && successPct < LOW_SUCCESS) flags.push('low');
    if (overdue > 0) flags.push('overdue');

    const topics: Record<string, TopicCell> = {};
    for (const [key, t] of Object.entries(p?.topics ?? {})) {
      topics[key] = { pct: percent(t.correct, t.total), total: t.total };
    }
    return {
      uid: m.uid,
      name: p?.displayName || m.displayName || 'Öğrenci',
      lastActiveAt,
      daysInactive,
      answered,
      successPct,
      streak,
      done,
      overdue,
      pending,
      flags,
      topics,
    };
  });
  rows.sort((a, b) => collator.compare(a.name, b.name));

  // Hardest questions of the last 7 days: how many students missed each one.
  const since = now - 7 * DAY;
  const misses = new Map<string, HardQuestion & { uids: Set<string> }>();
  for (const a of assignments) {
    for (const s of submissions[a.id] ?? []) {
      if (!memberIds.has(s.uid) || s.completedAt < since) continue;
      for (const mistake of s.mistakes ?? []) {
        const key = `${a.id}|${mistake.prompt}`;
        const entry = misses.get(key) ?? {
          prompt: mistake.prompt,
          correctAnswer: mistake.correctAnswer,
          misses: 0,
          assignmentTitle: a.title,
          uids: new Set<string>(),
        };
        entry.uids.add(s.uid);
        entry.misses = entry.uids.size;
        misses.set(key, entry);
      }
    }
  }
  const hardest = [...misses.values()]
    .sort((a, b) => b.misses - a.misses)
    .slice(0, 5)
    .map(({ uids: _uids, ...q }) => q);

  const totalAnswered = rows.reduce((n, r) => n + r.answered, 0);
  const totalCorrect = [...progressByUid.values()].reduce((n, p) => n + (p.correct ?? 0), 0);
  const slots = members.length * assignments.length;
  const doneSlots = rows.reduce((n, r) => n + r.done, 0);

  return {
    summary: {
      students: members.length,
      active7: rows.filter((r) => r.daysInactive !== null && r.daysInactive < INACTIVE_DAYS).length,
      assignments: assignments.length,
      submissionRate: slots ? Math.round((doneSlots / slots) * 100) : null,
      avgSuccess: percent(totalCorrect, totalAnswered),
    },
    rows,
    columns,
    weakTopics,
    hardest,
  };
}

function csvCell(value: string | number | null): string {
  let text = value === null ? '' : String(value);
  // Names are typed by students: keep spreadsheet apps from running them as formulas.
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatDay(ts: number | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** Semicolon CSV with a BOM, which Turkish Excel opens with the right letters. */
export function trackingCsv(t: ClassTracking): string {
  const header = [
    'Öğrenci',
    'Son etkinlik',
    'Çözülen soru',
    'Başarı %',
    'Seri (gün)',
    'Tamamlanan ödev',
    'Geciken ödev',
    ...t.columns.map((c) => `${c.subject ? c.subject + ' - ' : ''}${c.label} %`),
  ];
  const lines = t.rows.map((r) => [
    r.name,
    formatDay(r.lastActiveAt),
    r.answered,
    r.successPct,
    r.streak,
    r.done,
    r.overdue,
    ...t.columns.map((c) => r.topics[c.key]?.pct ?? null),
  ]);
  return '﻿' + [header, ...lines].map((cells) => cells.map(csvCell).join(';')).join('\r\n');
}
