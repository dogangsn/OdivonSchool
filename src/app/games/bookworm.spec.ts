import { BOOK_MILESTONES, PROVINCES, REGIONS, bookwormSummary, mapProgress, provinceForBook, validateBook } from './bookworm';

describe('Kitaplarla Türkiye', () => {
  it('has all 81 iller exactly once', () => {
    expect(PROVINCES.length).toBe(81);
    const plates = new Set(PROVINCES.map((p) => p.plate));
    expect(plates.size).toBe(81);
    for (let i = 1; i <= 81; i++) expect(plates.has(i)).withContext(`plaka ${i}`).toBeTrue();
  });

  it('opens one il per book, region by region', () => {
    expect(provinceForBook(1).name).toBe('İstanbul');
    const p = mapProgress(11);
    expect(p.opened.size).toBe(11);
    expect(p.completedRegions).toEqual(['marmara']);
    expect(p.next.region).toBe('ege');
  });

  it('starts a new lap after 81 books', () => {
    const p = mapProgress(83);
    expect(p.laps).toBe(1);
    expect(p.opened.size).toBe(81);
    expect(p.completedRegions.length).toBe(REGIONS.length);
    expect(provinceForBook(82).name).toBe('İstanbul');
  });

  it('starts empty', () => {
    const p = mapProgress(0);
    expect(p.opened.size).toBe(0);
    expect(p.next.name).toBe('İstanbul');
  });
});

describe('Okuma Kurdu', () => {
  it('validates and cleans a book', () => {
    const r = validateBook({ title: '  Küçük   Prens ', author: '', pages: 96, finishedOn: '2026-10-19', rating: 9 });
    expect(r.ok).toBeTrue();
    if (r.ok) {
      expect(r.book.title).toBe('Küçük Prens');
      expect(r.book.rating).toBe(5);
    }
    expect(validateBook({ title: 'A', author: '', pages: 10, finishedOn: '2026-10-19', rating: 0 }).ok).toBeFalse();
    expect(validateBook({ title: 'Kitap', author: '', pages: 0, finishedOn: '2026-10-19', rating: 0 }).ok).toBeFalse();
  });

  it('sums books and pages for the class summary', () => {
    const s = bookwormSummary('u1', 'Ada', [
      { id: 'a', title: 'Bir', author: '', pages: 40, finishedOn: '2026-10-01', rating: 0, createdAt: 1 },
      { id: 'b', title: 'İki', author: '', pages: 60, finishedOn: '2026-10-02', rating: 0, createdAt: 2 },
    ], 99);
    expect(s).toEqual({ uid: 'u1', displayName: 'Ada', books: 2, pages: 100, lastTitle: 'İki', lastAt: 99 });
  });

  it('has increasing milestones', () => {
    for (let i = 1; i < BOOK_MILESTONES.length; i++) {
      expect(BOOK_MILESTONES[i].books).toBeGreaterThan(BOOK_MILESTONES[i - 1].books);
    }
  });
});
