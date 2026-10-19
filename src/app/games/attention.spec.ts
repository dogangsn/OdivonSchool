import {
  LISTEN_PRESETS,
  RADAR_PRESETS,
  commandLength,
  commandText,
  listenBoard,
  listenSequence,
  radarScore,
  radarStream,
  tallyRadar,
} from './attention';

function seeded(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
}

describe('Dikkat Radarı', () => {
  it('puts the planned number of targets in the stream, never first', () => {
    for (const p of RADAR_PRESETS) {
      const s = radarStream(p, seeded(5));
      expect(s.length).toBe(p.stimuli);
      expect(s.filter((x) => x === p.target).length).toBe(Math.round(p.stimuli * p.targetRate));
      expect(s[0]).not.toBe(p.target);
    }
  });

  it('tallies hits, misses and false alarms', () => {
    const t = tallyRadar(['a', 'T', 'b', 'T'], [true, true, false, false], 'T');
    expect(t).toEqual({ hits: 1, misses: 1, falseAlarms: 1, correctRejections: 1 });
  });

  it('never scores below zero', () => {
    expect(radarScore({ hits: 0, misses: 5, falseAlarms: 9, correctRejections: 0 }, 0)).toBe(0);
  });
});

describe('Dinle ve Uygula', () => {
  it('builds a board of distinct chips', () => {
    const b = listenBoard(12, seeded(2));
    expect(b.length).toBe(12);
    expect(new Set(b.map((c) => c.id)).size).toBe(12);
  });

  it('grows the command every two rounds', () => {
    const p = LISTEN_PRESETS[0];
    expect(commandLength(p, 0)).toBe(2);
    expect(commandLength(p, 1)).toBe(2);
    expect(commandLength(p, 2)).toBe(3);
  });

  it('never repeats a chip back to back', () => {
    const b = listenBoard(4, seeded(9));
    const seq = listenSequence(b, 10, seeded(3));
    for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toBe(seq[i - 1]);
  });

  it('writes a natural Turkish command', () => {
    expect(commandText(['mavi-kare', 'sarı-yıldız', 'kırmızı-daire'])).toBe(
      'Önce mavi kareye, sonra sarı yıldıza, en son kırmızı daireye dokun.'
    );
    expect(commandText(['yeşil-üçgen', 'mavi-kare'])).toBe('Önce yeşil üçgene, en son mavi kareye dokun.');
  });
});
