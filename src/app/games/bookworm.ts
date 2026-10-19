/**
 * Okuma Kurdu + Kitaplarla Türkiye: every finished book opens the next il on
 * the reading map. Iller open region by region, so region badges come one
 * after another instead of all at the very end.
 */
export interface Province {
  plate: number;
  name: string;
  region: RegionId;
}

export type RegionId = 'marmara' | 'ege' | 'akdeniz' | 'icanadolu' | 'karadeniz' | 'doguanadolu' | 'guneydogu';

export const REGIONS: { id: RegionId; name: string; emoji: string }[] = [
  { id: 'marmara', name: 'Marmara', emoji: '🌉' },
  { id: 'ege', name: 'Ege', emoji: '🫒' },
  { id: 'akdeniz', name: 'Akdeniz', emoji: '🍊' },
  { id: 'icanadolu', name: 'İç Anadolu', emoji: '🌾' },
  { id: 'karadeniz', name: 'Karadeniz', emoji: '🌲' },
  { id: 'doguanadolu', name: 'Doğu Anadolu', emoji: '🏔️' },
  { id: 'guneydogu', name: 'Güneydoğu Anadolu', emoji: '🏺' },
];

const BY_REGION: Record<RegionId, [number, string][]> = {
  marmara: [[34, 'İstanbul'], [16, 'Bursa'], [41, 'Kocaeli'], [54, 'Sakarya'], [10, 'Balıkesir'], [17, 'Çanakkale'], [22, 'Edirne'], [39, 'Kırklareli'], [59, 'Tekirdağ'], [77, 'Yalova'], [11, 'Bilecik']],
  ege: [[35, 'İzmir'], [9, 'Aydın'], [48, 'Muğla'], [20, 'Denizli'], [45, 'Manisa'], [64, 'Uşak'], [43, 'Kütahya'], [3, 'Afyonkarahisar']],
  akdeniz: [[7, 'Antalya'], [33, 'Mersin'], [1, 'Adana'], [31, 'Hatay'], [80, 'Osmaniye'], [46, 'Kahramanmaraş'], [32, 'Isparta'], [15, 'Burdur']],
  icanadolu: [[6, 'Ankara'], [42, 'Konya'], [38, 'Kayseri'], [26, 'Eskişehir'], [58, 'Sivas'], [50, 'Nevşehir'], [51, 'Niğde'], [68, 'Aksaray'], [40, 'Kırşehir'], [71, 'Kırıkkale'], [66, 'Yozgat'], [18, 'Çankırı'], [70, 'Karaman']],
  karadeniz: [[61, 'Trabzon'], [55, 'Samsun'], [53, 'Rize'], [52, 'Ordu'], [28, 'Giresun'], [8, 'Artvin'], [29, 'Gümüşhane'], [69, 'Bayburt'], [60, 'Tokat'], [5, 'Amasya'], [19, 'Çorum'], [57, 'Sinop'], [37, 'Kastamonu'], [74, 'Bartın'], [78, 'Karabük'], [67, 'Zonguldak'], [81, 'Düzce'], [14, 'Bolu']],
  doguanadolu: [[25, 'Erzurum'], [65, 'Van'], [44, 'Malatya'], [23, 'Elazığ'], [36, 'Kars'], [4, 'Ağrı'], [75, 'Ardahan'], [76, 'Iğdır'], [24, 'Erzincan'], [62, 'Tunceli'], [12, 'Bingöl'], [49, 'Muş'], [13, 'Bitlis'], [30, 'Hakkari']],
  guneydogu: [[27, 'Gaziantep'], [63, 'Şanlıurfa'], [21, 'Diyarbakır'], [47, 'Mardin'], [2, 'Adıyaman'], [72, 'Batman'], [56, 'Siirt'], [73, 'Şırnak'], [79, 'Kilis']],
};

/** All 81 iller in the order they open. */
export const PROVINCES: Province[] = REGIONS.flatMap((r) =>
  BY_REGION[r.id].map(([plate, name]) => ({ plate, name, region: r.id }))
);

/** The il the n-th book (1-based) opens; after 81 the tour starts again. */
export function provinceForBook(n: number): Province {
  return PROVINCES[(Math.max(1, n) - 1) % PROVINCES.length];
}

export interface MapProgress {
  opened: Set<number>;
  /** Full laps around Türkiye. */
  laps: number;
  completedRegions: RegionId[];
  next: Province;
}

export function mapProgress(bookCount: number): MapProgress {
  const n = Math.max(0, Math.floor(bookCount));
  const laps = Math.floor(n / PROVINCES.length);
  const inLap = n % PROVINCES.length;
  const openedCount = laps > 0 && inLap === 0 ? PROVINCES.length : inLap;
  const opened = new Set(PROVINCES.slice(0, laps > 0 ? PROVINCES.length : openedCount).map((p) => p.plate));
  const completedRegions = REGIONS.filter((r) => BY_REGION[r.id].every(([plate]) => opened.has(plate))).map((r) => r.id);
  return { opened, laps, completedRegions, next: PROVINCES[inLap] };
}

export function provincesOf(region: RegionId): Province[] {
  return PROVINCES.filter((p) => p.region === region);
}

// --- book log ---

export interface BookEntry {
  id: string;
  title: string;
  author: string;
  pages: number;
  /** YYYY-MM-DD */
  finishedOn: string;
  /** 1-5 stars; 0 = not rated. */
  rating: number;
  createdAt: number;
}

export type BookDraft = Pick<BookEntry, 'title' | 'author' | 'pages' | 'finishedOn' | 'rating'>;

/** Cleans a typed-in book; returns an error message when it can't be saved. */
export function validateBook(d: BookDraft): { ok: true; book: BookDraft } | { ok: false; error: string } {
  const title = d.title.replace(/\s+/g, ' ').trim().slice(0, 120);
  const author = d.author.replace(/\s+/g, ' ').trim().slice(0, 80);
  const pages = Math.floor(Number(d.pages));
  if (title.length < 2) return { ok: false, error: 'Kitabın adını yaz.' };
  if (!(pages >= 1 && pages <= 2000)) return { ok: false, error: 'Sayfa sayısı 1 ile 2000 arasında olmalı.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.finishedOn)) return { ok: false, error: 'Bitirme tarihini seç.' };
  const rating = Math.max(0, Math.min(5, Math.floor(Number(d.rating) || 0)));
  return { ok: true, book: { title, author, pages, finishedOn: d.finishedOn, rating } };
}

/** Kitap rozetleri: thresholds of finished books. */
export const BOOK_MILESTONES: { books: number; emoji: string; title: string }[] = [
  { books: 1, emoji: '🐛', title: 'İlk Kitap' },
  { books: 5, emoji: '📗', title: 'Kitap Kurdu' },
  { books: 10, emoji: '🦋', title: 'Okuma Kelebeği' },
  { books: 25, emoji: '🚂', title: 'Okuma Treni' },
  { books: 50, emoji: '🏆', title: 'Kitap Ustası' },
  { books: 81, emoji: '🇹🇷', title: 'Türkiye Turu' },
];

/** classes/{classId}/bookworm/{uid}: what the teacher and classmates see. */
export interface BookwormSummary {
  uid: string;
  displayName: string;
  books: number;
  pages: number;
  lastTitle: string;
  lastAt: number;
}

export function bookwormSummary(uid: string, displayName: string, books: readonly BookEntry[], now: number): BookwormSummary {
  const latest = [...books].sort((a, b) => b.createdAt - a.createdAt)[0];
  return {
    uid,
    displayName: (displayName || 'Öğrenci').slice(0, 80),
    books: books.length,
    pages: books.reduce((n, b) => n + b.pages, 0),
    lastTitle: latest ? latest.title.slice(0, 120) : '',
    lastAt: now,
  };
}
