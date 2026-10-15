/**
 * classes/{classId}/reading/{uid}: a student's running read-aloud summary
 * for one class, written by the student's own app and read by the teacher.
 * Firestore rules mirror these bounds (see `// --- reading` in firestore.rules).
 */
export interface ReadingSummary {
  uid: string;
  displayName: string;
  sessions: number;
  lastWcpm: number;
  bestWcpm: number;
  /** 0-100 */
  lastAccuracy: number;
  lastTextId: string;
  lastAt: number;
  /** Most recent first, unique, at most MAX_STRUGGLED. */
  struggled: string[];
}

export interface ReadingSession {
  textId: string;
  wcpm: number;
  accuracy: number;
  struggled: string[];
  at: number;
}

export const MAX_STRUGGLED = 20;
export const MAX_WCPM = 400;
const MAX_WORD_LENGTH = 40;

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(Number.isFinite(n) ? n : 0)));
}

/** The next summary document after one more reading session. */
export function nextReadingSummary(
  prev: ReadingSummary | null,
  user: { uid: string; displayName?: string | null },
  session: ReadingSession
): ReadingSummary {
  const lastWcpm = clampInt(session.wcpm, 0, MAX_WCPM);
  const seen = new Set<string>();
  const struggled: string[] = [];
  for (const raw of [...session.struggled, ...(prev?.struggled ?? [])]) {
    const word = String(raw).trim().slice(0, MAX_WORD_LENGTH);
    const key = word.toLocaleLowerCase('tr');
    if (!word || seen.has(key)) continue;
    seen.add(key);
    struggled.push(word);
    if (struggled.length === MAX_STRUGGLED) break;
  }
  return {
    uid: user.uid,
    displayName: (user.displayName || 'Öğrenci').slice(0, 80),
    sessions: (prev?.sessions ?? 0) + 1,
    lastWcpm,
    bestWcpm: Math.max(lastWcpm, clampInt(prev?.bestWcpm ?? 0, 0, MAX_WCPM)),
    lastAccuracy: clampInt(session.accuracy, 0, 100),
    lastTextId: session.textId.slice(0, 40),
    lastAt: Math.round(session.at),
    struggled,
  };
}

/** Words several students of a class stumbled on, most students first. */
export function classStruggledWords(rows: ReadingSummary[], limit = 12): { word: string; students: number }[] {
  const counts = new Map<string, { word: string; students: number }>();
  for (const r of rows) {
    const mine = new Set<string>();
    for (const w of r.struggled ?? []) {
      const key = w.toLocaleLowerCase('tr');
      if (mine.has(key)) continue;
      mine.add(key);
      const entry = counts.get(key) ?? { word: w, students: 0 };
      entry.students++;
      counts.set(key, entry);
    }
  }
  const collator = new Intl.Collator('tr');
  return [...counts.values()]
    .sort((a, b) => b.students - a.students || collator.compare(a.word, b.word))
    .slice(0, limit);
}
