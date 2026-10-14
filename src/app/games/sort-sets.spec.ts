import { ITEMS_PER_GAME, SORT_SETS, SortSet, binLabel, itemsForGame, sortScore, sortSetById } from './sort-sets';

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('sort sets', () => {
  it('has well-formed content', () => {
    expect(SORT_SETS.length).toBeGreaterThanOrEqual(5);
    const ids = SORT_SETS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const set of SORT_SETS) {
      expect(set.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(set.bins.length).withContext(set.id).toBeGreaterThanOrEqual(2);
      expect(set.bins.length).withContext(set.id).toBeLessThanOrEqual(3);
      expect(set.items.length).withContext(set.id).toBeGreaterThanOrEqual(12);
      expect(set.grades.every((g) => g >= 1 && g <= 4)).withContext(set.id).toBeTrue();
      const binIds = set.bins.map((b) => b.id);
      for (const it of set.items) {
        expect(binIds).withContext(`${set.id}: ${it.text}`).toContain(it.bin);
      }
      for (const b of set.bins) {
        expect(set.items.filter((i) => i.bin === b.id).length).withContext(`${set.id}/${b.id}`).toBeGreaterThanOrEqual(3);
      }
      const texts = set.items.map((i) => i.text);
      expect(new Set(texts).size).withContext(set.id).toBe(texts.length);
    }
  });

  it('finds sets and bin labels', () => {
    const set = sortSetById('canli-cansiz')!;
    expect(set.title).toBe('Canlı mı, Cansız mı?');
    expect(binLabel(set, 'cansiz')).toBe('Cansız');
    expect(sortSetById('yok')).toBeUndefined();
  });

  it('spreads a round evenly over the bins', () => {
    const three = sortSetById('kati-sivi-gaz')!;
    for (let seed = 1; seed < 30; seed++) {
      const round = itemsForGame(three, seeded(seed));
      expect(round.length).toBe(ITEMS_PER_GAME);
      expect(new Set(round).size).toBe(round.length);
      const perBin = three.bins.map((b) => round.filter((i) => i.bin === b.id).length);
      expect(Math.max(...perBin) - Math.min(...perBin)).toBeLessThanOrEqual(1);
    }
    const two = sortSetById('meyve-sebze')!;
    const round = itemsForGame(two, seeded(5));
    expect(round.filter((i) => i.bin === 'meyve').length).toBe(5);
  });

  it('fills up from bigger bins when one bin runs out', () => {
    const lopsided: Pick<SortSet, 'bins' | 'items'> = {
      bins: [
        { id: 'a', label: 'A', emoji: '' },
        { id: 'b', label: 'B', emoji: '' },
      ],
      items: [
        { text: 'a1', bin: 'a' },
        { text: 'a2', bin: 'a' },
        ...Array.from({ length: 10 }, (_, i) => ({ text: `b${i}`, bin: 'b' })),
      ],
    };
    const round = itemsForGame(lopsided, seeded(9));
    expect(round.length).toBe(10);
    expect(round.filter((i) => i.bin === 'a').length).toBe(2);
    expect(itemsForGame(lopsided, seeded(9), 4).length).toBe(4);
  });

  it('scores accuracy and speed, never below 50', () => {
    expect(sortScore(10, 0, 0)).toBe(1200);
    expect(sortScore(10, 2, 30_000)).toBe(10 * 100 - 60 + 80);
    expect(sortScore(10, 0, 120_000)).toBe(1000);
    expect(sortScore(2, 30, 300_000)).toBe(50);
  });
});
