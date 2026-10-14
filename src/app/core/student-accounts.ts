/**
 * Accounts a teacher opens for young students: a short kullanıcı adı and an
 * easy password, no real e-mail. Firebase Auth still needs an e-mail, so the
 * username maps to an address on a domain nobody receives mail for.
 */
export const STUDENT_EMAIL_DOMAIN = 'ogrenci.odivonschool.firebaseapp.com';
export const MAX_ACCOUNTS_PER_BATCH = 40;

const TR_MAP: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', i: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };
/** No 0/o, 1/l/i: children copy these from paper. */
const SUFFIX_ALPHABET = 'abcdefghjkmnprstuvyz23456789';
const PASSWORD_WORDS = [
  'elma', 'armut', 'kedi', 'kopek', 'balik', 'kumru', 'aslan', 'kaplan', 'zebra', 'panda',
  'bulut', 'gunes', 'deniz', 'nehir', 'orman', 'cicek', 'yildiz', 'roket', 'kalem', 'kitap',
  'balon', 'ucurtma', 'limon', 'kiraz', 'cilek', 'portakal', 'tavsan', 'sincap', 'kartal', 'yunus',
];

type Rng = () => number;

function pick<T>(list: ArrayLike<T>, rng: Rng): T {
  return list[Math.floor(rng() * list.length)];
}

/** "Ayşe Nur Yılmaz" → "ayse": first name, Turkish letters folded, letters only. */
export function usernameBase(fullName: string): string {
  const first = fullName.trim().toLocaleLowerCase('tr').split(/\s+/)[0] ?? '';
  const folded = [...first].map((ch) => TR_MAP[ch] ?? ch).join('');
  const base = folded.replace(/[^a-z]/g, '').slice(0, 12);
  return base || 'ogrenci';
}

export function makeUsername(fullName: string, rng: Rng = Math.random): string {
  let suffix = '';
  for (let i = 0; i < 4; i++) suffix += pick(SUFFIX_ALPHABET, rng);
  return `${usernameBase(fullName)}.${suffix}`;
}

/** Easy to type, at least 6 characters (Firebase minimum): "kedi47". */
export function makePassword(rng: Rng = Math.random): string {
  const n = 10 + Math.floor(rng() * 90);
  return `${pick(PASSWORD_WORDS, rng)}${n}`;
}

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`;
}

/** The login box accepts an e-mail or a teacher-given kullanıcı adı. */
export function loginIdToEmail(id: string): string {
  const clean = id.trim();
  return clean.includes('@') ? clean : usernameToEmail(clean);
}

export function isStudentAccountEmail(email: string | undefined | null): boolean {
  return !!email && email.toLowerCase().endsWith(`@${STUDENT_EMAIL_DOMAIN}`);
}

/** One name per line; blank lines and duplicates dropped, names tidied. */
export function parseNameList(text: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const name = raw.replace(/\s+/g, ' ').trim().slice(0, 60);
    const key = name.toLocaleLowerCase('tr');
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}
