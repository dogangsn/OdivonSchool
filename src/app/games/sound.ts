/**
 * Tiny sound + speech helpers for the games. Everything is optional: a
 * browser without Web Audio / speech synthesis just stays silent.
 */
const SOUND_KEY = 'odivon_game_sound';

let ctx: AudioContext | null = null;

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    // Private mode etc. — the toggle just won't persist.
  }
}

function tone(freq: number, startOffset: number, duration: number, type: OscillatorType = 'sine') {
  if (!soundEnabled()) return;
  try {
    ctx ??= new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t = ctx.currentTime + startOffset;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  } catch {
    // Audio is a nice-to-have.
  }
}

export const sfx = {
  correct() {
    tone(660, 0, 0.12);
    tone(880, 0.09, 0.16);
  },
  wrong() {
    tone(220, 0, 0.25, 'triangle');
  },
  combo() {
    tone(784, 0, 0.1);
    tone(988, 0.08, 0.1);
    tone(1175, 0.16, 0.18);
  },
  finish() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.25));
  },
  flip() {
    tone(520, 0, 0.06, 'square');
  },
};

/** Reads text aloud in Turkish (for 1-2. sınıf players who are still learning to read). */
export function speak(text: string) {
  try {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(
      text.replace(/×/g, ' çarpı ').replace(/÷/g, ' bölü ').replace(/−/g, ' eksi ').replace(/\+/g, ' artı ').replace(/☐/g, ' kutu ')
    );
    u.lang = 'tr-TR';
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  } catch {
    // Speech is optional.
  }
}

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}
