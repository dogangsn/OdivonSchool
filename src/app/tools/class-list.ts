/**
 * The teacher's class list for the board tools (şans çarkı, grup oluşturucu).
 * It lives in this browser only, like a sticky note on the board computer.
 */
const KEY = 'odivon_tools_class_list';

/** One name per line or comma; blanks and repeats are dropped. */
export function parseNames(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[\n,;]+/)) {
    const name = raw.replace(/\s+/g, ' ').trim();
    if (!name) continue;
    const key = name.toLocaleLowerCase('tr');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name.slice(0, 40));
    if (out.length >= 60) break;
  }
  return out;
}

export function loadClassList(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((n) => typeof n === 'string') : [];
  } catch {
    return [];
  }
}

export function saveClassList(names: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(names));
  } catch {
    // Private mode: the list just won't be remembered.
  }
}

/** Fisher-Yates on a copy; `rand` is injectable for tests. */
export function shuffled<T>(items: readonly T[], rand: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Splits names into `count` groups as evenly as possible (sizes differ by at
 * most one), after shuffling.
 */
export function makeGroups(names: readonly string[], count: number, rand: () => number = Math.random): string[][] {
  const n = Math.max(1, Math.min(Math.floor(count) || 1, names.length || 1));
  const groups: string[][] = Array.from({ length: n }, () => []);
  shuffled(names, rand).forEach((name, i) => groups[i % n].push(name));
  return groups;
}
