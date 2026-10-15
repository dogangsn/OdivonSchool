import {
  alignStep,
  alignTranscript,
  alignWords,
  buildPassage,
  cleanWord,
  currentToken,
  foldTurkish,
  heardWords,
  initialAlign,
  isFinished,
  listenerStatuses,
  normalizeTurkish,
  numberToWords,
  readingFeedback,
  readingStars,
  readingStats,
  similarity,
  speedLevel,
  spokenForms,
  tokenHeard,
  tokenStatuses,
  wordsMatch,
} from './reading-align';

const MINA = 'Bu kedi Mina. Mina minik bir kedi. Mina süt içer. Top ile oynar. Akşam olunca sepetinde uyur.';

function statusesFor(text: string, transcript: string) {
  const passage = buildPassage(text);
  return tokenStatuses(passage, alignTranscript(passage, transcript));
}

describe('reading-align: normalizing', () => {
  it('lowercases with Turkish rules (İ→i, I→ı) and strips punctuation', () => {
    expect(normalizeTurkish('İSTİKLAL Marşı’nı söyledik!')).toBe('istiklal marşını söyledik');
    expect(normalizeTurkish('IŞIK, ılık; ISPARTA.')).toBe('ışık ılık ısparta');
    expect(normalizeTurkish('“Ali’yi” gördü… — sonra?')).toBe('aliyi gördü sonra');
  });

  it('folds Turkish letters for recognizers that drop them', () => {
    expect(foldTurkish('çiçekler ağaçta şarkı söylüyor')).toBe('cicekler agacta sarki soyluyor');
  });

  it('turns numbers into words, including thousands and case suffixes', () => {
    expect(numberToWords(23)).toBe('yirmi üç');
    expect(numberToWords(1920)).toBe('bin dokuz yüz yirmi');
    expect(numberToWords(2000)).toBe('iki bin');
    expect(spokenForms('23')).toEqual(['yirmi', 'üç']);
    expect(spokenForms('23te')).toEqual(['yirmi', 'üçte']);
    expect(spokenForms('kedi')).toEqual(['kedi']);
    expect(heardWords('23 Nisan 1920 günü')).toEqual(['yirmi', 'üç', 'nisan', 'bin', 'dokuz', 'yüz', 'yirmi', 'günü']);
  });

  it('builds on-screen tokens, gluing lone punctuation to the word before', () => {
    const p = buildPassage('Merhaba — dedi Ali’ye. 23 Nisan!');
    expect(p.tokens.map((t) => t.display)).toEqual(['Merhaba —', 'dedi', 'Ali’ye.', '23', 'Nisan!']);
    expect(p.tokens.map((t) => t.norm)).toEqual(['merhaba', 'dedi', 'aliye', '23', 'nisan']);
    expect(p.units.length).toBe(6); // "23" is said as two words
  });

  it('keeps the word itself for struggled-word chips', () => {
    expect(cleanWord('Ali’yi”')).toBe('Ali’yi');
    expect(cleanWord('“Kardan')).toBe('Kardan');
    expect(cleanWord('gökkuşağı.')).toBe('gökkuşağı');
  });
});

describe('reading-align: matching words', () => {
  it('needs an exact match for short words', () => {
    expect(wordsMatch('bir', 'bir')).toBeTrue();
    expect(wordsMatch('bi', 'bir')).toBeFalse();
    expect(wordsMatch('ile', 'ise')).toBeFalse();
  });

  it('tolerates small recognizer spelling noise in longer words', () => {
    expect(wordsMatch('pencerede', 'pencereden')).toBeTrue();
    expect(wordsMatch('kabardi', 'kabardı')).toBeTrue();
    expect(wordsMatch('cicekler', 'çiçekler')).toBeTrue();
    expect(similarity('içti', 'içer')).toBeLessThan(0.75);
    expect(wordsMatch('içti', 'içer')).toBeFalse();
    expect(wordsMatch('köpek', 'kedi')).toBeFalse();
  });
});

describe('reading-align: alignment', () => {
  it('marks a fluent read all correct and finishes', () => {
    const passage = buildPassage(MINA);
    const state = alignTranscript(passage, 'bu kedi mina mina minik bir kedi mina süt içer top ile oynar akşam olunca sepetinde uyur');
    expect(isFinished(passage, state)).toBeTrue();
    expect(tokenStatuses(passage, state).every((s) => s === 'correct')).toBeTrue();
    expect(currentToken(passage, state)).toBe(-1);
  });

  it('marks a skipped word as atlandı', () => {
    const s = statusesFor(MINA, 'bu kedi mina mina minik kedi mina');
    expect(s.slice(0, 8)).toEqual(['correct', 'correct', 'correct', 'correct', 'correct', 'skipped', 'correct', 'correct']);
  });

  it('marks a misread word as yanlış and remembers what was heard', () => {
    const passage = buildPassage(MINA);
    const state = alignTranscript(passage, 'bu kedi mina mina minik bir kedi mina süt içti top ile');
    const s = tokenStatuses(passage, state);
    expect(s[9]).toBe('wrong'); // içer
    expect(s[10]).toBe('correct'); // top
    expect(tokenHeard(passage, state)[9]).toBe('içti');
  });

  it('accepts a self-correction', () => {
    const s = statusesFor(MINA, 'bu kedi mina mina minik bir kedi mina süt içti içer top');
    expect(s[9]).toBe('correct');
    expect(s[10]).toBe('correct');
  });

  it('accepts a word read syllable by syllable', () => {
    const text = 'Yağmur dinince gökte bir gökkuşağı çıkıyor.';
    const s = statusesFor(text, 'yağmur dinince gökte bir gök kuşağı çıkıyor');
    expect(s).toEqual(['correct', 'correct', 'correct', 'correct', 'correct', 'correct']);
  });

  it('does not count re-reading or hesitation sounds as errors', () => {
    const s = statusesFor(MINA, 'bu kedi bu kedi ııı mina mina minik');
    expect(s.slice(0, 5)).toEqual(['correct', 'correct', 'correct', 'correct', 'correct']);
    expect(s[5]).toBe('pending');
  });

  it('handles two misread words in a row', () => {
    const text = 'Kedi uyudu ve rüya gördü.';
    const s = statusesFor(text, 'köpek oynadı ve rüya gördü');
    expect(s).toEqual(['wrong', 'wrong', 'correct', 'correct', 'correct']);
  });

  it('lets a short word skip only one word ahead', () => {
    // "bir" is two words ahead of "evi": a stray "bir" must not jump there.
    const text = 'Evi güzel bir koku sardı.';
    const passage = buildPassage(text);
    const state = alignWords(passage, ['bir']);
    expect(state.pointer).toBe(0);
    expect(tokenStatuses(passage, state)[0]).toBe('wrong');
  });

  it('matches digits from the recognizer against a passage number', () => {
    const text = '23 Nisan sabahı okulumuz bayraklarla süslenmişti.';
    expect(statusesFor(text, '23 Nisan sabahı okulumuz bayraklarla süslenmişti').every((s) => s === 'correct')).toBeTrue();
    expect(statusesFor(text, 'yirmi üç nisan sabahı okulumuz bayraklarla süslenmişti').every((s) => s === 'correct')).toBeTrue();
    expect(statusesFor('23 Nisan 1920 günü meclis açıldı.', 'yirmi üç nisan 1920 günü meclis açıldı').every((s) => s === 'correct')).toBeTrue();
  });

  it('matches digits from the recognizer against number words in the passage', () => {
    const s = statusesFor('Sınıfta yirmi üç öğrenci var.', 'sınıfta 23 öğrenci var');
    expect(s).toEqual(['correct', 'correct', 'correct', 'correct', 'correct']);
  });

  it('shows a half-read number as still in progress', () => {
    const passage = buildPassage('23 Nisan');
    const state = alignTranscript(passage, 'yirmi');
    expect(tokenStatuses(passage, state)).toEqual(['pending', 'pending']);
    expect(currentToken(passage, state)).toBe(0);
  });

  it('gives the same result word by word as all at once (interim results)', () => {
    const passage = buildPassage(MINA);
    const words = heardWords('bu kedi mina mina minik kedi mina süt içti içer top ile oynar');
    let state = initialAlign(passage);
    for (const w of words) state = alignStep(passage, state, w);
    expect(state).toEqual(alignWords(passage, words));
  });

  it('ignores words after the end of the passage', () => {
    const passage = buildPassage('Lale çok seviniyor.');
    const state = alignTranscript(passage, 'lale çok seviniyor evet bitti');
    expect(isFinished(passage, state)).toBeTrue();
    expect(tokenStatuses(passage, state)).toEqual(['correct', 'correct', 'correct']);
  });
});

describe('reading-align: results', () => {
  it('computes accuracy, WCPM and struggled words', () => {
    const passage = buildPassage(MINA);
    const statuses = tokenStatuses(passage, alignTranscript(passage, 'bu kedi mina mina minik kedi mina süt içti top ile oynar akşam olunca sepetinde uyur'));
    const stats = readingStats(passage, statuses, 30_000);
    expect(stats.totalWords).toBe(17);
    expect(stats.correct).toBe(15);
    expect(stats.wrong).toBe(1);
    expect(stats.skipped).toBe(1);
    expect(stats.unread).toBe(0);
    expect(stats.accuracy).toBe(88);
    expect(stats.wcpm).toBe(30);
    expect(stats.struggled).toEqual(['bir', 'içer']);
  });

  it('counts only the part read when the child stops early', () => {
    const passage = buildPassage(MINA);
    const statuses = tokenStatuses(passage, alignTranscript(passage, 'bu kedi mina mina minik'));
    const stats = readingStats(passage, statuses, 15_000);
    expect(stats.correct).toBe(5);
    expect(stats.unread).toBe(12);
    expect(stats.accuracy).toBe(100);
    expect(stats.wcpm).toBe(20);
  });

  it('lists a struggled word once', () => {
    const text = 'Mina kedi. Mina kedi.';
    const passage = buildPassage(text);
    const stats = readingStats(passage, ['wrong', 'correct', 'skipped', 'correct'], 10_000);
    expect(stats.struggled).toEqual(['Mina']);
  });

  it('builds listener-mode statuses from tapped words', () => {
    expect(listenerStatuses(5, [1, 3])).toEqual(['correct', 'wrong', 'correct', 'wrong', 'correct']);
    expect(listenerStatuses(5, [1], 2)).toEqual(['correct', 'wrong', 'correct', 'pending', 'pending']);
  });

  it('gives stars from accuracy and speed', () => {
    const band = { min: 70, max: 90 };
    expect(readingStars(98, 80, band, 40)).toBe(3);
    expect(readingStars(92, 55, band, 40)).toBe(2);
    expect(readingStars(97, 30, band, 40)).toBe(2);
    expect(readingStars(60, 30, band, 10)).toBe(1);
    expect(readingStars(0, 0, band, 0)).toBe(0);
  });

  it('compares speed with the grade band in kind words', () => {
    const band = { min: 70, max: 90 };
    expect(speedLevel(50, band)).toBe('growing');
    expect(speedLevel(80, band)).toBe('onTarget');
    expect(speedLevel(120, band)).toBe('above');
    for (const [wcpm, accuracy] of [[30, 60], [30, 95], [80, 95], [120, 98], [120, 70]]) {
      const text = readingFeedback({ wcpm, accuracy }, band);
      expect(text.length).toBeGreaterThan(10);
      expect(text).not.toMatch(/yavaşsın|kötü|başarısız|yetersiz/i);
    }
  });
});
