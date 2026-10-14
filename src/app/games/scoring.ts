import { BadgeDef, GameOutcome } from './game-models';

/** Hız Turu: rewards accuracy first, then volume. */
export function speedStars(correct: number, total: number): 0 | 1 | 2 | 3 {
  const accuracy = total ? correct / total : 0;
  if (correct >= 15 && accuracy >= 0.85) return 3;
  if (correct >= 8 && accuracy >= 0.7) return 2;
  if (correct >= 3) return 1;
  return 0;
}

/** Bilgi Yarışması: share of correct answers. */
export function quizStars(correct: number, total: number): 0 | 1 | 2 | 3 {
  const accuracy = total ? correct / total : 0;
  if (accuracy >= 0.9) return 3;
  if (accuracy >= 0.7) return 2;
  if (accuracy >= 0.4) return 1;
  return 0;
}

/** Eşleştir: fewer wrong flips, more stars. */
export function matchStars(mistakes: number): 1 | 2 | 3 {
  if (mistakes <= 2) return 3;
  if (mistakes <= 6) return 2;
  return 1;
}

/** Sınıflandır: wrong drops against the number of items. */
export function sortStars(mistakes: number, total: number): 1 | 2 | 3 {
  if (mistakes <= 1) return 3;
  if (mistakes <= Math.max(2, Math.ceil(total * 0.3))) return 2;
  return 1;
}

/** Combo multiplier: ×2 after 3 in a row, ×3 after 6, ×4 after 9. */
export function comboMultiplier(streak: number): number {
  return Math.min(4, 1 + Math.floor(streak / 3));
}

export const MAX_XP_PER_GAME = 300;

export function xpForOutcome(o: Pick<GameOutcome, 'score' | 'stars' | 'correct'>): number {
  if (o.correct === 0) return 2; // showing up still counts a little
  const xp = Math.round(o.score / 10) + o.stars * 10;
  return Math.max(5, Math.min(MAX_XP_PER_GAME, xp));
}

/** Level n starts at 50·(n−1)² XP: 0, 50, 200, 450, 800... */
export function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;
}

export function levelProgress(xp: number): number {
  const level = levelForXp(xp);
  const start = 50 * (level - 1) ** 2;
  const end = 50 * level ** 2;
  return Math.round(((xp - start) / (end - start)) * 100);
}

/** YYYY-MM-DD in the player's local time zone. */
export function localDay(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/** Daily streak after playing on `today`. */
export function nextStreak(lastPlayed: string | undefined, current: number, today: Date): number {
  const todayKey = localDay(today);
  if (lastPlayed === todayKey) return Math.max(1, current);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  return lastPlayed === localDay(yesterday) ? current + 1 : 1;
}

export interface BadgeContext {
  outcome: GameOutcome;
  xpTotal: number;
  streakDays: number;
}

interface BadgeRule extends BadgeDef {
  earned(ctx: BadgeContext): boolean;
}

const BADGE_RULES: BadgeRule[] = [
  { id: 'ilk-adim', emoji: '🐣', title: 'İlk Adım', description: 'İlk oyununu bitirdin', earned: () => true },
  { id: 'uc-yildiz', emoji: '⭐', title: 'Üç Yıldız', description: 'Bir oyunda 3 yıldız aldın', earned: (c) => c.outcome.stars === 3 },
  { id: 'seri-3', emoji: '🔥', title: '3 Günlük Seri', description: '3 gün üst üste oynadın', earned: (c) => c.streakDays >= 3 },
  { id: 'seri-7', emoji: '🌟', title: 'Haftanın Yıldızı', description: '7 gün üst üste oynadın', earned: (c) => c.streakDays >= 7 },
  { id: 'xp-500', emoji: '🎖️', title: '500 XP', description: '500 XP topladın', earned: (c) => c.xpTotal >= 500 },
  { id: 'xp-2000', emoji: '🏅', title: '2000 XP', description: '2000 XP topladın', earned: (c) => c.xpTotal >= 2000 },
  {
    id: 'hiz-ustasi',
    emoji: '⚡',
    title: 'Hız Ustası',
    description: 'Bir Hız Turu’nda 20 doğru yaptın',
    earned: (c) => c.outcome.gameType === 'speed' && c.outcome.correct >= 20,
  },
  {
    id: 'kombo-kral',
    emoji: '👑',
    title: 'Kombo Kralı',
    description: 'Art arda 10 doğru cevap verdin',
    earned: (c) => (c.outcome.meta?.maxCombo ?? 0) >= 10,
  },
  {
    id: 'hafiza-ustasi',
    emoji: '🧠',
    title: 'Hafıza Ustası',
    description: 'Eşleştir’i hiç hata yapmadan bitirdin',
    earned: (c) => c.outcome.gameType === 'match' && c.outcome.meta?.matchMistakes === 0,
  },
  {
    id: 'bilgi-kurdu',
    emoji: '📚',
    title: 'Bilgi Kurdu',
    description: 'Bilgi Yarışması’nda tüm soruları bildin',
    earned: (c) => c.outcome.gameType === 'quiz' && c.outcome.total > 0 && c.outcome.correct === c.outcome.total,
  },
  {
    id: 'dogru-dedektif',
    emoji: '🕵️',
    title: 'Doğru Dedektifi',
    description: 'Doğru mu Yanlış mı’da tüm cümleleri bildin',
    earned: (c) => c.outcome.gameType === 'truefalse' && c.outcome.total > 0 && c.outcome.correct === c.outcome.total,
  },
  {
    id: 'duzen-ustasi',
    emoji: '🗂️',
    title: 'Düzen Ustası',
    description: 'Sınıflandır’ı hiç hata yapmadan bitirdin',
    earned: (c) => c.outcome.gameType === 'sort' && c.outcome.total > 0 && c.outcome.mistakes.length === 0,
  },
];

export const ALL_BADGES: BadgeDef[] = BADGE_RULES.map(({ earned, ...def }) => def);

export function badgeById(id: string): BadgeDef | undefined {
  return ALL_BADGES.find((b) => b.id === id);
}

/** Badges earned by this game that the player doesn't have yet. */
export function newBadges(ctx: BadgeContext, owned: readonly string[]): BadgeDef[] {
  return BADGE_RULES.filter((b) => !owned.includes(b.id) && b.earned(ctx)).map(
    ({ earned, ...def }) => def
  );
}
