/**
 * Göz jimnastiği: where the target dot is at time t, for each exercise.
 * Coordinates are 0..1 across the stage; `t` is seconds, `speed` laps/second.
 */
export type EyePattern = 'yatay' | 'dikey' | 'z' | 'sonsuzluk' | 'cevresel';

export const EYE_PATTERNS: { id: EyePattern; title: string; hint: string }[] = [
  { id: 'yatay', title: 'Yatay', hint: 'Başını oynatmadan, yalnızca gözlerinle soldan sağa takip et.' },
  { id: 'dikey', title: 'Dikey', hint: 'Topu yukarıdan aşağıya gözlerinle izle.' },
  { id: 'z', title: 'Z Sıçrama', hint: 'Satır okur gibi: soldan sağa, sonra alt satırın başına sıçra.' },
  { id: 'sonsuzluk', title: 'Sonsuzluk', hint: 'Yatay sekiz çizen topu kesintisiz takip et.' },
  { id: 'cevresel', title: 'Çevresel', hint: 'Gözünü ortadaki noktada tut, köşelerde yanan yıldızları fark et.' },
];

export interface EyePoint {
  x: number;
  y: number;
}

/** Smooth back-and-forth 0..1..0 */
function pingPong(p: number) {
  const f = p - Math.floor(p);
  return f < 0.5 ? f * 2 : 2 - f * 2;
}

function ease(v: number) {
  return 0.5 - Math.cos(v * Math.PI) / 2;
}

export function eyePoint(pattern: EyePattern, t: number, speed: number): EyePoint {
  const p = t * speed;
  const m = 0.08; // keep the dot off the edges
  const span = (v: number) => m + v * (1 - 2 * m);
  switch (pattern) {
    case 'yatay':
      return { x: span(ease(pingPong(p))), y: 0.5 };
    case 'dikey':
      return { x: 0.5, y: span(ease(pingPong(p))) };
    case 'z': {
      // 4 lines per lap: move across a line, then jump to the next line's start.
      const lines = 4;
      const lap = (p * lines) % lines;
      const line = Math.floor(lap);
      const f = lap - line;
      return { x: span(Math.min(1, f * 1.15)), y: span(line / (lines - 1)) };
    }
    case 'sonsuzluk': {
      const a = p * 2 * Math.PI;
      return { x: 0.5 + 0.42 * Math.sin(a), y: 0.5 + 0.3 * Math.sin(a) * Math.cos(a) };
    }
    case 'cevresel':
      return { x: 0.5, y: 0.5 };
  }
}

/** Çevresel: which corner glows at time t (0-3), changing about once a second. */
export function peripheralCorner(t: number, speed: number): number {
  const step = Math.floor(t * Math.max(0.5, speed * 2));
  // Deterministic but jumpy order.
  return (step * 7 + 3) % 4;
}
