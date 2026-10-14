import {
  CLOCK_PRESETS,
  addMinutes,
  angleFromVector,
  clockDistractors,
  clockExplanation,
  clockPresetById,
  digitAccusative,
  formatDigital,
  generateClockProblem,
  generateClockRound,
  handSnap,
  hourFromAngle,
  hourHandAngle,
  minuteFromAngle,
  minuteHandAngle,
  moveMinuteHand,
  parseDigital,
  sameTime,
  timePhrase,
} from './clock-game';

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('clock-game', () => {
  describe('timePhrase', () => {
    const cases: [number, number, string][] = [
      [3, 0, 'saat üç'],
      [12, 0, 'saat on iki'],
      [3, 30, 'saat üç buçuk'],
      [11, 30, 'saat on bir buçuk'],
      [3, 15, 'saat üçü çeyrek geçiyor'],
      [4, 15, 'saat dördü çeyrek geçiyor'],
      [6, 15, 'saat altıyı çeyrek geçiyor'],
      [12, 15, 'saat on ikiyi çeyrek geçiyor'],
      [3, 45, 'saat dörde çeyrek var'],
      [4, 45, 'saat beşe çeyrek var'],
      [5, 45, 'saat altıya çeyrek var'],
      [12, 45, 'saat bire çeyrek var'],
      [11, 45, 'saat on ikiye çeyrek var'],
      [3, 10, 'saat üçü on geçiyor'],
      [1, 5, 'saat biri beş geçiyor'],
      [9, 25, 'saat dokuzu yirmi beş geçiyor'],
      [10, 20, 'saat onu yirmi geçiyor'],
      [2, 7, 'saat ikiyi yedi geçiyor'],
      [3, 50, 'saat dörde on var'],
      [7, 35, 'saat sekize yirmi beş var'],
      [8, 59, 'saat dokuza bir var'],
      [9, 40, 'saat ona yirmi var'],
      [10, 55, 'saat on bire beş var'],
    ];
    for (const [h, m, text] of cases) {
      it(`${h}:${m} → ${text}`, () => expect(timePhrase({ hour: h, minute: m })).toBe(text));
    }

    it('has a phrase for every minute of every hour', () => {
      for (let h = 1; h <= 12; h++) {
        for (let m = 0; m < 60; m++) {
          const t = timePhrase({ hour: h, minute: m });
          expect(t).toMatch(/^saat [a-zçğıöşü ]+$/);
          expect(t).not.toContain('undefined');
        }
      }
    });
  });

  it('formats and parses digital times', () => {
    expect(formatDigital({ hour: 3, minute: 5 })).toBe('03:05');
    expect(formatDigital({ hour: 12, minute: 45 })).toBe('12:45');
    expect(parseDigital('03:30')).toEqual({ hour: 3, minute: 30 });
    expect(parseDigital('13:00')).toBeNull();
    expect(parseDigital('0:00')).toBeNull();
    expect(parseDigital('saat')).toBeNull();
  });

  it('writes digits with their accusative ending', () => {
    expect([1, 2, 3, 4, 6, 9, 10, 12].map(digitAccusative)).toEqual(["1’i", "2’yi", "3’ü", "4’ü", "6’yı", "9’u", "10’u", "12’yi"]);
  });

  describe('hand geometry', () => {
    it('places the hands', () => {
      expect(minuteHandAngle({ hour: 3, minute: 15 })).toBe(90);
      expect(hourHandAngle({ hour: 3, minute: 0 })).toBe(90);
      expect(hourHandAngle({ hour: 3, minute: 30 })).toBe(105);
      expect(hourHandAngle({ hour: 12, minute: 0 })).toBe(0);
    });

    it('reads angles clockwise from 12', () => {
      expect(angleFromVector(0, -10)).toBeCloseTo(0);
      expect(angleFromVector(10, 0)).toBeCloseTo(90);
      expect(angleFromVector(0, 10)).toBeCloseTo(180);
      expect(angleFromVector(-10, 0)).toBeCloseTo(270);
    });

    it('snaps the minute hand', () => {
      expect(minuteFromAngle(88, 5)).toBe(15);
      expect(minuteFromAngle(357, 5)).toBe(0);
      expect(minuteFromAngle(100, 1)).toBe(17);
      expect(minuteFromAngle(170, 15)).toBe(30);
    });

    it('finds the hour from the hour hand, taking the minute into account', () => {
      expect(hourFromAngle(90, 0)).toBe(3);
      expect(hourFromAngle(112.5, 45)).toBe(3); // between 3 and 4 at :45 is still 3
      expect(hourFromAngle(118, 0)).toBe(4);
      expect(hourFromAngle(2, 0)).toBe(12);
      expect(hourFromAngle(350, 30)).toBe(11);
    });

    it('moves the hour on when the minute hand passes 12', () => {
      expect(moveMinuteHand({ hour: 3, minute: 55 }, 5)).toEqual({ hour: 4, minute: 5 });
      expect(moveMinuteHand({ hour: 4, minute: 5 }, 50)).toEqual({ hour: 3, minute: 50 });
      expect(moveMinuteHand({ hour: 12, minute: 50 }, 0)).toEqual({ hour: 1, minute: 0 });
      expect(moveMinuteHand({ hour: 1, minute: 0 }, 55)).toEqual({ hour: 12, minute: 55 });
      expect(moveMinuteHand({ hour: 3, minute: 10 }, 40)).toEqual({ hour: 3, minute: 40 });
    });

    it('adds minutes on a 12-hour dial', () => {
      expect(addMinutes({ hour: 12, minute: 59 }, 1)).toEqual({ hour: 1, minute: 0 });
      expect(addMinutes({ hour: 1, minute: 0 }, -1)).toEqual({ hour: 12, minute: 59 });
      expect(addMinutes({ hour: 11, minute: 30 }, 30)).toEqual({ hour: 12, minute: 0 });
      expect(addMinutes({ hour: 6, minute: 0 }, 720)).toEqual({ hour: 6, minute: 0 });
    });

    it('snaps to the numbers except on the dakika level', () => {
      expect(CLOCK_PRESETS.map(handSnap)).toEqual([5, 5, 5, 1]);
    });
  });

  it('explains with hand names and the phrase', () => {
    const e = clockExplanation({ hour: 3, minute: 45 });
    expect(e).toContain('9’u');
    expect(e).toContain('Saat dörde çeyrek var');
    expect(e).toContain('03:45');
    expect(clockExplanation({ hour: 5, minute: 0 })).toContain('5’i');
    expect(clockExplanation({ hour: 5, minute: 2 })).toContain('2 dakika');
    expect(clockExplanation({ hour: 5, minute: 23 })).toContain('4 ile 5 arasında');
  });

  it('distractors are unique and differ from the answer', () => {
    const rng = seeded(3);
    for (const preset of CLOCK_PRESETS) {
      for (let i = 0; i < 200; i++) {
        const t = { hour: 1 + Math.floor(rng() * 12), minute: preset.step === 1 ? Math.floor(rng() * 60) : 0 };
        const ds = clockDistractors(t, preset.step, rng);
        expect(ds.length).toBe(3);
        const keys = ds.map(formatDigital);
        expect(new Set(keys).size).toBe(3);
        expect(keys).not.toContain(formatDigital(t));
        ds.forEach((d) => {
          expect(d.hour).toBeGreaterThanOrEqual(1);
          expect(d.hour).toBeLessThanOrEqual(12);
          expect(d.minute).toBeGreaterThanOrEqual(0);
          expect(d.minute).toBeLessThan(60);
        });
      }
    }
  });

  it('includes the swapped-hands mistake', () => {
    const ds = clockDistractors({ hour: 3, minute: 30 }, 30, seeded(1)).map(formatDigital);
    // 3:30 with the hands swapped is 6:15; it's one of the most likely picks, but shuffled.
    const all = new Set<string>();
    for (let s = 1; s < 30; s++) clockDistractors({ hour: 3, minute: 30 }, 30, seeded(s)).forEach((d) => all.add(formatDigital(d)));
    expect(all.has('06:15')).toBeTrue();
    expect(ds.length).toBe(3);
  });

  it('every preset generates valid problems on its step', () => {
    const rng = seeded(42);
    for (const preset of CLOCK_PRESETS) {
      for (const mode of ['read', 'set'] as const) {
        for (let i = 0; i < 300; i++) {
          const p = generateClockProblem(preset, mode, rng);
          expect(p.target.minute % preset.step).toBe(0);
          expect(p.digital).toBe(formatDigital(p.target));
          expect(p.phrase).toBe(timePhrase(p.target));
          expect(p.explanation.length).toBeGreaterThan(20);
          if (mode === 'read') {
            expect(p.options.length).toBe(4);
            expect(p.options).toContain(p.digital);
            expect(new Set(p.options).size).toBe(4);
          } else {
            expect(p.options).toEqual([]);
            expect(sameTime(p.target, { hour: 12, minute: 0 })).toBeFalse();
          }
        }
      }
    }
  });

  it('the dakika level mostly asks for minutes between the numbers', () => {
    const preset = clockPresetById('saat-dakika')!;
    const rng = seeded(9);
    let between = 0;
    for (let i = 0; i < 400; i++) if (generateClockProblem(preset, 'read', rng).target.minute % 5 !== 0) between++;
    expect(between).toBeGreaterThan(200);
  });

  it('a round has 10 different times, both modes', () => {
    const rng = seeded(7);
    for (const preset of CLOCK_PRESETS) {
      for (let r = 0; r < 30; r++) {
        const round = generateClockRound(preset, rng);
        expect(round.length).toBe(10);
        expect(new Set(round.map((p) => p.digital)).size).toBe(10);
        expect(round.filter((p) => p.mode === 'read').length).toBe(5);
        expect(round.filter((p) => p.mode === 'set').length).toBe(5);
      }
    }
  });

  it('preset ids are unique and grades are ilkokul', () => {
    expect(new Set(CLOCK_PRESETS.map((p) => p.id)).size).toBe(CLOCK_PRESETS.length);
    CLOCK_PRESETS.forEach((p) => p.grades.forEach((g) => expect(g).toBeGreaterThanOrEqual(1)));
    expect(clockPresetById('yok')).toBeUndefined();
  });
});
