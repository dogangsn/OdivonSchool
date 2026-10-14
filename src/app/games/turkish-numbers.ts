/**
 * Turkish number words with the case suffixes the math games need. Suffixes
 * follow the last word ("on iki" → "on ikiye"), so the tables only cover the
 * words a number can end with (bir…dokuz, on). Hand-written rather than
 * derived, because consonant softening (dört → dördü) and buffer letters
 * (altı → altıyı) are easy to get wrong.
 */
const ONES = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
const TENS = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan'];

type Suffixed = Record<string, string>;

/** Belirtme hâli (-ı): "saat üçü çeyrek geçiyor". */
const ACCUSATIVE: Suffixed = {
  bir: 'biri',
  iki: 'ikiyi',
  üç: 'üçü',
  dört: 'dördü',
  beş: 'beşi',
  altı: 'altıyı',
  yedi: 'yediyi',
  sekiz: 'sekizi',
  dokuz: 'dokuzu',
  on: 'onu',
};

/** Yönelme hâli (-e): "saat dörde çeyrek var". */
const DATIVE: Suffixed = {
  bir: 'bire',
  iki: 'ikiye',
  üç: 'üçe',
  dört: 'dörde',
  beş: 'beşe',
  altı: 'altıya',
  yedi: 'yediye',
  sekiz: 'sekize',
  dokuz: 'dokuza',
  on: 'ona',
};

/** Bulunma hâli (-de): kesir okumada payda, "dörtte üç". */
const LOCATIVE: Suffixed = {
  bir: 'birde',
  iki: 'ikide',
  üç: 'üçte',
  dört: 'dörtte',
  beş: 'beşte',
  altı: 'altıda',
  yedi: 'yedide',
  sekiz: 'sekizde',
  dokuz: 'dokuzda',
  on: 'onda',
};

/** İyelik + belirtme (-(s)ını): "dörtte üçünü boya". */
const POSSESSIVE_ACCUSATIVE: Suffixed = {
  bir: 'birini',
  iki: 'ikisini',
  üç: 'üçünü',
  dört: 'dördünü',
  beş: 'beşini',
  altı: 'altısını',
  yedi: 'yedisini',
  sekiz: 'sekizini',
  dokuz: 'dokuzunu',
  on: 'onunu',
};

/** 0-999 in words: 25 → "yirmi beş", 100 → "yüz", 340 → "üç yüz kırk". */
export function numberWords(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999) throw new RangeError(`numberWords: ${n}`);
  if (n === 0) return 'sıfır';
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  if (h) parts.push(h === 1 ? 'yüz' : `${ONES[h]} yüz`);
  const t = Math.floor((n % 100) / 10);
  if (t) parts.push(TENS[t]);
  const o = n % 10;
  if (o) parts.push(ONES[o]);
  return parts.join(' ');
}

function withSuffix(n: number, table: Suffixed): string {
  if (!Number.isInteger(n) || n < 1 || n > 99 || (n > 10 && n % 10 === 0)) {
    // Only numbers ending in bir…dokuz or exactly "on" are in the tables.
    throw new RangeError(`suffix table has no entry for ${n}`);
  }
  const words = numberWords(n).split(' ');
  const last = words.pop()!;
  return [...words, table[last]].join(' ');
}

/** 3 → "üçü", 12 → "on ikiyi". */
export function accusative(n: number): string {
  return withSuffix(n, ACCUSATIVE);
}

/** 4 → "dörde", 12 → "on ikiye". */
export function dative(n: number): string {
  return withSuffix(n, DATIVE);
}

/** 4 → "dörtte", 6 → "altıda". */
export function locative(n: number): string {
  return withSuffix(n, LOCATIVE);
}

/** 3 → "üçünü", 6 → "altısını". */
export function possessiveAccusative(n: number): string {
  return withSuffix(n, POSSESSIVE_ACCUSATIVE);
}
