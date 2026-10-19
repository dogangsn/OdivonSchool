/**
 * "Öğretmenim kaç ders kaldı?": where the school day is right now, from a
 * simple timetable (first lesson start, lesson length, breaks, lunch).
 */
export interface DayPlan {
  /** "08:30" */
  start: string;
  lessonCount: number;
  lessonMinutes: number;
  breakMinutes: number;
  /** Lunch comes after this lesson (1-based); 0 = no lunch break. */
  lunchAfter: number;
  lunchMinutes: number;
}

export const DEFAULT_DAY: DayPlan = {
  start: '08:30',
  lessonCount: 6,
  lessonMinutes: 40,
  breakMinutes: 10,
  lunchAfter: 4,
  lunchMinutes: 40,
};

export interface Slot {
  kind: 'lesson' | 'break' | 'lunch';
  /** Lesson number for lessons; the lesson it follows for breaks. */
  index: number;
  startMin: number;
  endMin: number;
}

export type DayStatus =
  | { phase: 'before'; minutesToStart: number; lessonsLeft: number }
  | { phase: 'lesson' | 'break' | 'lunch'; slot: Slot; minutesLeft: number; lessonsLeft: number }
  | { phase: 'after'; lessonsLeft: 0 };

export function toMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return 0;
  return Math.min(23, +m[1]) * 60 + Math.min(59, +m[2]);
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function buildSlots(plan: DayPlan): Slot[] {
  const slots: Slot[] = [];
  let t = toMinutes(plan.start);
  const count = Math.max(1, Math.min(12, plan.lessonCount));
  for (let i = 1; i <= count; i++) {
    slots.push({ kind: 'lesson', index: i, startMin: t, endMin: t + plan.lessonMinutes });
    t += plan.lessonMinutes;
    if (i === count) break;
    const lunch = plan.lunchAfter === i && plan.lunchMinutes > 0;
    const len = lunch ? plan.lunchMinutes : plan.breakMinutes;
    if (len > 0) {
      slots.push({ kind: lunch ? 'lunch' : 'break', index: i, startMin: t, endMin: t + len });
      t += len;
    }
  }
  return slots;
}

/** `nowMin` is minutes since midnight (fractions allowed). */
export function dayStatus(plan: DayPlan, nowMin: number): DayStatus {
  const slots = buildSlots(plan);
  const lessons = slots.filter((s) => s.kind === 'lesson');
  const first = slots[0];
  const last = slots[slots.length - 1];
  if (nowMin < first.startMin) {
    return { phase: 'before', minutesToStart: Math.ceil(first.startMin - nowMin), lessonsLeft: lessons.length };
  }
  if (nowMin >= last.endMin) return { phase: 'after', lessonsLeft: 0 };
  const slot = slots.find((s) => nowMin >= s.startMin && nowMin < s.endMin)!;
  // The lesson in progress still counts as "left".
  const lessonsLeft = lessons.filter((l) => l.endMin > nowMin).length;
  return { phase: slot.kind, slot, minutesLeft: Math.ceil(slot.endMin - nowMin), lessonsLeft };
}
