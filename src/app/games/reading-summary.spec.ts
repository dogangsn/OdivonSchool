import { MAX_STRUGGLED, ReadingSummary, classStruggledWords, nextReadingSummary } from './reading-summary';

const user = { uid: 'u1', displayName: 'Ece' };

describe('reading-summary', () => {
  it('starts a summary on the first session', () => {
    const s = nextReadingSummary(null, user, { textId: 'minik-kedi', wcpm: 42.4, accuracy: 93.6, struggled: ['içer'], at: 1000 });
    expect(s).toEqual({
      uid: 'u1',
      displayName: 'Ece',
      sessions: 1,
      lastWcpm: 42,
      bestWcpm: 42,
      lastAccuracy: 94,
      lastTextId: 'minik-kedi',
      lastAt: 1000,
      struggled: ['içer'],
    });
  });

  it('counts sessions, keeps the best speed and the newest struggled words first', () => {
    const prev = nextReadingSummary(null, user, { textId: 'a', wcpm: 60, accuracy: 90, struggled: ['kabardı', 'koku'], at: 1 });
    const next = nextReadingSummary(prev, user, { textId: 'b', wcpm: 50, accuracy: 100, struggled: ['Koku', 'gökkuşağı'], at: 2 });
    expect(next.sessions).toBe(2);
    expect(next.lastWcpm).toBe(50);
    expect(next.bestWcpm).toBe(60);
    expect(next.struggled).toEqual(['Koku', 'gökkuşağı', 'kabardı']);
  });

  it('keeps values inside the bounds the rules allow', () => {
    const many = Array.from({ length: 30 }, (_, i) => `kelime${i}`);
    const s = nextReadingSummary(null, { uid: 'u2', displayName: null }, { textId: 'x', wcpm: 9999, accuracy: 140, struggled: many, at: 5 });
    expect(s.lastWcpm).toBe(400);
    expect(s.lastAccuracy).toBe(100);
    expect(s.struggled.length).toBe(MAX_STRUGGLED);
    expect(s.displayName).toBe('Öğrenci');
  });

  it('finds the words most students stumble on', () => {
    const row = (uid: string, struggled: string[]) => ({ uid, struggled }) as ReadingSummary;
    const words = classStruggledWords([row('a', ['koku', 'kabardı']), row('b', ['Koku']), row('c', ['ağaç'])]);
    expect(words[0]).toEqual({ word: 'koku', students: 2 });
    expect(words.map((w) => w.word)).toEqual(['koku', 'ağaç', 'kabardı']);
  });
});
