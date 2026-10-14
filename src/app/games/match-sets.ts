import { SPEED_PRESETS, generateMathPairs, shuffled } from './math-generator';

/** A set of term ↔ match pairs for the Eşleştir (hafıza kartları) game. */
export interface MatchSet {
  id: string;
  title: string;
  description: string;
  emoji: string;
  subject: string;
  grades: number[];
  /** Fixed pairs; a game uses PAIRS_PER_GAME of them at random. */
  pairs?: [string, string][];
  /** Math sets are generated from a Hız Turu preset instead. */
  mathPresetId?: string;
}

export const PAIRS_PER_GAME = 6;

export const MATCH_SETS: MatchSet[] = [
  {
    id: 'es-anlamli',
    title: 'Eş Anlamlı Kelimeler',
    description: 'Aynı anlama gelen kelimeleri bul',
    emoji: '🤝',
    subject: 'Türkçe',
    grades: [2, 3, 4],
    pairs: [
      ['siyah', 'kara'],
      ['cevap', 'yanıt'],
      ['misafir', 'konuk'],
      ['hediye', 'armağan'],
      ['yıl', 'sene'],
      ['doktor', 'hekim'],
      ['kelime', 'sözcük'],
      ['okul', 'mektep'],
      ['beyaz', 'ak'],
      ['kırmızı', 'al'],
    ],
  },
  {
    id: 'zit-anlamli',
    title: 'Zıt Anlamlı Kelimeler',
    description: 'Birbirinin tersi olan kelimeleri eşleştir',
    emoji: '🔄',
    subject: 'Türkçe',
    grades: [1, 2, 3, 4],
    pairs: [
      ['büyük', 'küçük'],
      ['uzun', 'kısa'],
      ['sıcak', 'soğuk'],
      ['açık', 'kapalı'],
      ['hızlı', 'yavaş'],
      ['gece', 'gündüz'],
      ['ağır', 'hafif'],
      ['dolu', 'boş'],
      ['temiz', 'kirli'],
      ['ileri', 'geri'],
      ['yaşlı', 'genç'],
    ],
  },
  {
    id: 'duyu-organlari',
    title: 'Duyu Organları',
    description: 'Organı ve görevini eşleştir',
    emoji: '👀',
    subject: 'Hayat Bilgisi',
    grades: [1, 2, 3],
    pairs: [
      ['göz', 'görme'],
      ['kulak', 'işitme'],
      ['burun', 'koklama'],
      ['dil', 'tatma'],
      ['deri', 'dokunma'],
    ],
  },
  {
    id: 'meslekler',
    title: 'Meslekler',
    description: 'Meslek ve çalıştığı yeri eşleştir',
    emoji: '🧑‍🚒',
    subject: 'Hayat Bilgisi',
    grades: [1, 2, 3],
    pairs: [
      ['doktor', 'hastane'],
      ['öğretmen', 'okul'],
      ['pilot', 'uçak'],
      ['aşçı', 'mutfak'],
      ['çiftçi', 'tarla'],
      ['itfaiyeci', 'itfaiye istasyonu'],
      ['eczacı', 'eczane'],
      ['fırıncı', 'fırın'],
    ],
  },
  {
    id: 'yasam-alanlari',
    title: 'Canlılar ve Yaşam Alanları',
    description: 'Hayvanı yaşadığı yerle eşleştir',
    emoji: '🐪',
    subject: 'Fen Bilimleri',
    grades: [3, 4],
    pairs: [
      ['balık', 'deniz'],
      ['deve', 'çöl'],
      ['kutup ayısı', 'buzullar'],
      ['arı', 'kovan'],
      ['köstebek', 'toprak altı'],
      ['penguen', 'Antarktika'],
    ],
  },
  ...SPEED_PRESETS.filter((p) => p.skills.length === 1 && p.skills[0] !== 'karsilastirma' && p.skills[0] !== 'ritmik').map(
    (p): MatchSet => ({
      id: `mat-${p.id}`,
      title: `${p.title} Eşleştir`,
      description: `İşlemi sonucuyla eşleştir (${p.description})`,
      emoji: p.emoji,
      subject: 'Matematik',
      grades: [p.grade],
      mathPresetId: p.id,
    })
  ),
];

export function matchSetById(id: string): MatchSet | undefined {
  return MATCH_SETS.find((s) => s.id === id);
}

/** Pairs for one game of the set. */
export function pairsForGame(set: MatchSet, rng: () => number = Math.random): [string, string][] {
  if (set.mathPresetId) {
    const preset = SPEED_PRESETS.find((p) => p.id === set.mathPresetId);
    return preset ? generateMathPairs(preset, PAIRS_PER_GAME, rng) : [];
  }
  return shuffled(rng, set.pairs ?? []).slice(0, PAIRS_PER_GAME);
}
