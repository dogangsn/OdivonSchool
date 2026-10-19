import { makeGroups, parseNames, shuffled } from './class-list';
import { DEFAULT_DAY, buildSlots, dayStatus, toMinutes } from './lessons';
import { buildWordSearch, normalizeWord, parseWords } from './word-search';

function seeded(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
}

describe('class list', () => {
  it('parses names from lines and commas, dropping blanks and repeats', () => {
    expect(parseNames('Ali\n  Ayşe , ali\n\nZeynep')).toEqual(['Ali', 'Ayşe', 'Zeynep']);
  });

  it('shuffles without losing anyone', () => {
    const names = ['a', 'b', 'c', 'd', 'e'];
    expect(shuffled(names, seeded(3)).sort()).toEqual(names);
  });

  it('makes even groups', () => {
    const groups = makeGroups(['a', 'b', 'c', 'd', 'e', 'f', 'g'], 3, seeded(1));
    expect(groups.length).toBe(3);
    expect(groups.map((g) => g.length).sort()).toEqual([2, 2, 3]);
    expect(groups.flat().sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  });

  it('never makes more groups than people', () => {
    expect(makeGroups(['a', 'b'], 5).length).toBe(2);
  });
});

describe('lessons left', () => {
  it('builds lessons, breaks and lunch', () => {
    const slots = buildSlots(DEFAULT_DAY);
    expect(slots.filter((s) => s.kind === 'lesson').length).toBe(6);
    expect(slots.filter((s) => s.kind === 'lunch').length).toBe(1);
    expect(slots[0].startMin).toBe(toMinutes('08:30'));
  });

  it('counts the lesson in progress as left', () => {
    const s = dayStatus(DEFAULT_DAY, toMinutes('08:45'));
    expect(s.phase).toBe('lesson');
    expect(s.lessonsLeft).toBe(6);
  });

  it('knows breaks, before school and after school', () => {
    expect(dayStatus(DEFAULT_DAY, toMinutes('09:15')).phase).toBe('break');
    expect(dayStatus(DEFAULT_DAY, toMinutes('07:00')).phase).toBe('before');
    expect(dayStatus(DEFAULT_DAY, toMinutes('18:00')).phase).toBe('after');
  });
});

describe('word search', () => {
  it('normalizes Turkish words', () => {
    expect(normalizeWord('çiçek!')).toBe('ÇİÇEK');
    expect(parseWords('elma, Elma\narmut\nx')).toEqual(['ELMA', 'ARMUT']);
  });

  it('places every word where it can be read back', () => {
    const words = ['KALEM', 'SİLGİ', 'DEFTER', 'KİTAP'];
    const ws = buildWordSearch(words, { size: 10, diagonal: true, backwards: true }, seeded(7));
    expect(ws.skipped).toEqual([]);
    for (const p of ws.placed) {
      const read = p.word.split('').map((_, i) => ws.grid[p.row + p.dr * i][p.col + p.dc * i]).join('');
      expect(read).toBe(p.word);
    }
    expect(ws.grid.every((r) => r.every((c) => c.length === 1))).toBeTrue();
  });

  it('skips words longer than the grid', () => {
    const ws = buildWordSearch(['ÇOKUZUNBIRKELIME'], { size: 8, diagonal: false, backwards: false });
    expect(ws.skipped).toEqual(['ÇOKUZUNBIRKELIME']);
  });
});
