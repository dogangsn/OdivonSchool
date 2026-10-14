import { shuffled } from './math-generator';

/** A labelled box items are sorted into. */
export interface SortBin {
  id: string;
  label: string;
  emoji: string;
}

export interface SortItem {
  text: string;
  /** Optional picture; letters and numbers have none. */
  emoji?: string;
  /** Id of the bin the item belongs to. */
  bin: string;
}

/** A set for the Sınıflandır (sürükle-bırak) game. */
export interface SortSet {
  id: string;
  title: string;
  description: string;
  emoji: string;
  subject: string;
  grades: number[];
  /** 2 or 3 boxes. */
  bins: SortBin[];
  /** A game uses ITEMS_PER_GAME of them, spread over the bins. */
  items: SortItem[];
}

export const ITEMS_PER_GAME = 10;

const item = (bin: string, text: string, emoji?: string): SortItem => (emoji ? { text, emoji, bin } : { text, bin });

export const SORT_SETS: SortSet[] = [
  {
    id: 'canli-cansiz',
    title: 'Canlı mı, Cansız mı?',
    description: 'Varlıkları canlı ve cansız olarak ayır',
    emoji: '🌱',
    subject: 'Hayat Bilgisi',
    grades: [1, 2, 3],
    bins: [
      { id: 'canli', label: 'Canlı', emoji: '🌱' },
      { id: 'cansiz', label: 'Cansız', emoji: '🪨' },
    ],
    items: [
      item('canli', 'köpek', '🐶'),
      item('canli', 'ağaç', '🌳'),
      item('canli', 'balık', '🐟'),
      item('canli', 'ayçiçeği', '🌻'),
      item('canli', 'arı', '🐝'),
      item('canli', 'çocuk', '🧒'),
      item('canli', 'kaplumbağa', '🐢'),
      item('canli', 'tırtıl', '🐛'),
      item('cansiz', 'taş', '🪨'),
      item('cansiz', 'araba', '🚗'),
      item('cansiz', 'kalem', '✏️'),
      item('cansiz', 'top', '⚽'),
      item('cansiz', 'su', '💧'),
      item('cansiz', 'oyuncak ayı', '🧸'),
      item('cansiz', 'sandalye', '🪑'),
      item('cansiz', 'Güneş', '☀️'),
    ],
  },
  {
    id: 'meyve-sebze',
    title: 'Meyve mi, Sebze mi?',
    description: 'Manavdaki besinleri doğru kasaya koy',
    emoji: '🧺',
    subject: 'Hayat Bilgisi',
    grades: [1, 2],
    bins: [
      { id: 'meyve', label: 'Meyve', emoji: '🍎' },
      { id: 'sebze', label: 'Sebze', emoji: '🥕' },
    ],
    items: [
      item('meyve', 'elma', '🍎'),
      item('meyve', 'muz', '🍌'),
      item('meyve', 'üzüm', '🍇'),
      item('meyve', 'çilek', '🍓'),
      item('meyve', 'armut', '🍐'),
      item('meyve', 'portakal', '🍊'),
      item('meyve', 'kiraz', '🍒'),
      item('meyve', 'karpuz', '🍉'),
      item('sebze', 'havuç', '🥕'),
      item('sebze', 'brokoli', '🥦'),
      item('sebze', 'marul', '🥬'),
      item('sebze', 'soğan', '🧅'),
      item('sebze', 'patates', '🥔'),
      item('sebze', 'sarımsak', '🧄'),
      item('sebze', 'patlıcan', '🍆'),
      item('sebze', 'biber', '🫑'),
    ],
  },
  {
    id: 'sesli-sessiz',
    title: 'Sesli mi, Sessiz mi?',
    description: 'Harfleri sesli ve sessiz harf olarak ayır',
    emoji: '🔤',
    subject: 'Türkçe',
    grades: [1, 2],
    bins: [
      { id: 'sesli', label: 'Sesli harf', emoji: '🔊' },
      { id: 'sessiz', label: 'Sessiz harf', emoji: '🤫' },
    ],
    items: [
      ...['a', 'e', 'ı', 'i', 'o', 'ö', 'u', 'ü'].map((h) => item('sesli', h)),
      ...['b', 'c', 'ç', 'd', 'k', 'l', 'm', 'n', 'r', 's', 'ş', 't', 'y', 'z'].map((h) => item('sessiz', h)),
    ],
  },
  {
    id: 'tasitlar',
    title: 'Kara, Deniz, Hava',
    description: 'Taşıtları kullanıldıkları yere göre ayır',
    emoji: '🚌',
    subject: 'Hayat Bilgisi',
    grades: [1, 2, 3],
    bins: [
      { id: 'kara', label: 'Kara taşıtı', emoji: '🛣️' },
      { id: 'deniz', label: 'Deniz taşıtı', emoji: '🌊' },
      { id: 'hava', label: 'Hava taşıtı', emoji: '☁️' },
    ],
    items: [
      item('kara', 'otomobil', '🚗'),
      item('kara', 'otobüs', '🚌'),
      item('kara', 'bisiklet', '🚲'),
      item('kara', 'tren', '🚆'),
      item('kara', 'ambulans', '🚑'),
      item('kara', 'traktör', '🚜'),
      item('deniz', 'gemi', '🚢'),
      item('deniz', 'vapur', '⛴️'),
      item('deniz', 'yelkenli', '⛵'),
      item('deniz', 'sürat teknesi', '🚤'),
      item('deniz', 'kano', '🛶'),
      item('hava', 'uçak', '✈️'),
      item('hava', 'helikopter', '🚁'),
      item('hava', 'pervaneli uçak', '🛩️'),
      item('hava', 'sıcak hava balonu', '🎈'),
    ],
  },
  {
    id: 'kati-sivi-gaz',
    title: 'Katı, Sıvı, Gaz',
    description: 'Maddeleri hâllerine göre ayır',
    emoji: '🧊',
    subject: 'Fen Bilimleri',
    grades: [3, 4],
    bins: [
      { id: 'kati', label: 'Katı', emoji: '🧱' },
      { id: 'sivi', label: 'Sıvı', emoji: '💧' },
      { id: 'gaz', label: 'Gaz', emoji: '💨' },
    ],
    items: [
      item('kati', 'taş', '🪨'),
      item('kati', 'buz', '🧊'),
      item('kati', 'kalem', '✏️'),
      item('kati', 'odun', '🪵'),
      item('kati', 'anahtar', '🔑'),
      item('kati', 'tuğla', '🧱'),
      item('sivi', 'su', '💧'),
      item('sivi', 'süt', '🥛'),
      item('sivi', 'bal', '🍯'),
      item('sivi', 'meyve suyu', '🧃'),
      item('sivi', 'zeytinyağı', '🫒'),
      item('gaz', 'hava', '💨'),
      item('gaz', 'su buharı', '♨️'),
      item('gaz', 'oksijen', '🫁'),
      item('gaz', 'balondaki helyum', '🎈'),
    ],
  },
  {
    id: 'isik-kaynaklari',
    title: 'Doğal mı, Yapay mı?',
    description: 'Işık kaynaklarını doğal ve yapay olarak ayır',
    emoji: '💡',
    subject: 'Fen Bilimleri',
    grades: [3, 4],
    bins: [
      { id: 'dogal', label: 'Doğal ışık kaynağı', emoji: '🌞' },
      { id: 'yapay', label: 'Yapay ışık kaynağı', emoji: '🔌' },
    ],
    items: [
      item('dogal', 'Güneş', '☀️'),
      item('dogal', 'yıldızlar', '⭐'),
      item('dogal', 'şimşek', '⚡'),
      item('dogal', 'ateş böceği', '✨'),
      item('dogal', 'yanardağdan akan lav', '🌋'),
      item('dogal', 'kutup ışıkları', '🌌'),
      item('yapay', 'ampul', '💡'),
      item('yapay', 'el feneri', '🔦'),
      item('yapay', 'mum', '🕯️'),
      item('yapay', 'trafik lambası', '🚦'),
      item('yapay', 'televizyon ekranı', '📺'),
      item('yapay', 'kandil', '🪔'),
      item('yapay', 'fener', '🏮'),
    ],
  },
  {
    id: 'tek-cift',
    title: 'Tek mi, Çift mi?',
    description: 'Sayıları tek ve çift olarak ayır',
    emoji: '🎲',
    subject: 'Matematik',
    grades: [2, 3, 4],
    bins: [
      { id: 'tek', label: 'Tek sayı', emoji: '1️⃣' },
      { id: 'cift', label: 'Çift sayı', emoji: '2️⃣' },
    ],
    items: [
      ...[3, 7, 11, 15, 19, 25, 33, 49, 57].map((n) => item('tek', String(n))),
      ...[4, 8, 12, 16, 20, 30, 46, 58, 64].map((n) => item('cift', String(n))),
    ],
  },
  {
    id: 'miknatis',
    title: 'Mıknatıs Çeker mi?',
    description: 'Mıknatısın çektiği ve çekmediği maddeleri ayır',
    emoji: '🧲',
    subject: 'Fen Bilimleri',
    grades: [3, 4],
    bins: [
      { id: 'ceker', label: 'Mıknatıs çeker', emoji: '🧲' },
      { id: 'cekmez', label: 'Mıknatıs çekmez', emoji: '🚫' },
    ],
    items: [
      item('ceker', 'ataş', '📎'),
      item('ceker', 'demir çivi', '🔩'),
      item('ceker', 'raptiye', '📌'),
      item('ceker', 'dikiş iğnesi', '🪡'),
      item('ceker', 'toplu iğne', '📍'),
      item('ceker', 'demir tel', '➰'),
      item('cekmez', 'kâğıt', '📄'),
      item('cekmez', 'tahta', '🪵'),
      item('cekmez', 'sünger', '🧽'),
      item('cekmez', 'plastik şişe', '🧴'),
      item('cekmez', 'cam bardak', '🥛'),
      item('cekmez', 'elma', '🍎'),
      item('cekmez', 'pelüş oyuncak', '🧸'),
    ],
  },
  {
    id: 'es-zit-anlam',
    title: 'Eş Anlam mı, Zıt Anlam mı?',
    description: 'Kelime çiftlerini anlamlarına göre ayır',
    emoji: '🔄',
    subject: 'Türkçe',
    grades: [2, 3, 4],
    bins: [
      { id: 'es', label: 'Eş anlamlı', emoji: '🤝' },
      { id: 'zit', label: 'Zıt anlamlı', emoji: '↔️' },
    ],
    items: [
      item('es', 'siyah – kara'),
      item('es', 'cevap – yanıt'),
      item('es', 'misafir – konuk'),
      item('es', 'hediye – armağan'),
      item('es', 'yıl – sene'),
      item('es', 'kelime – sözcük'),
      item('es', 'doktor – hekim'),
      item('zit', 'büyük – küçük'),
      item('zit', 'sıcak – soğuk'),
      item('zit', 'gece – gündüz'),
      item('zit', 'uzun – kısa'),
      item('zit', 'dolu – boş'),
      item('zit', 'temiz – kirli'),
      item('zit', 'hızlı – yavaş'),
    ],
  },
];

export function sortSetById(id: string): SortSet | undefined {
  return SORT_SETS.find((s) => s.id === id);
}

export function binLabel(set: Pick<SortSet, 'bins'>, binId: string): string {
  return set.bins.find((b) => b.id === binId)?.label ?? binId;
}

/**
 * Items for one round, spread as evenly as the set allows over the bins
 * (round-robin from each bin's shuffled items), then shuffled.
 */
export function itemsForGame(
  set: Pick<SortSet, 'bins' | 'items'>,
  rng: () => number = Math.random,
  count = ITEMS_PER_GAME
): SortItem[] {
  const queues = shuffled(rng, set.bins).map((b) => shuffled(rng, set.items.filter((i) => i.bin === b.id)));
  const picked: SortItem[] = [];
  while (picked.length < count && queues.some((q) => q.length)) {
    for (const q of queues) {
      const next = q.shift();
      if (next && picked.length < count) picked.push(next);
    }
  }
  return shuffled(rng, picked);
}

/** Score for a finished round: 100 per item, −30 per wrong drop, up to +200 for speed. */
export function sortScore(total: number, mistakes: number, durationMs: number): number {
  const timeBonus = Math.max(0, 200 - Math.floor(durationMs / 1000) * 4);
  return Math.max(50, total * 100 - mistakes * 30 + timeBonus);
}
