import { addDays, buildAnnualPlan, chunk, mondayOf, planToWordHtml, suggestedWeeklyHours } from './annual-plan';

const themes = [
  { order: 1, title: 'Sayılar', hours: 40, keyConcepts: ['sayı'], outcomes: [1, 2, 3, 4].map((i) => ({ code: `M.${i}`, text: `k${i}` })) },
  { order: 2, title: 'Geometri', hours: 20, keyConcepts: ['şekil'], outcomes: [{ code: 'G.1', text: 'g' }] },
  { order: 3, title: 'Ölçme', hours: 20, keyConcepts: [], outcomes: [] },
];

describe('yıllık plan', () => {
  it('finds Mondays', () => {
    expect(mondayOf('2026-09-16')).toBe('2026-09-14');
    expect(mondayOf('2026-09-14')).toBe('2026-09-14');
    expect(addDays('2026-12-28', 7)).toBe('2027-01-04');
  });

  it('splits into nearly equal chunks', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2, 3], [4, 5]]);
    expect(chunk([1], 3).flat()).toEqual([1]);
  });

  it('suggests weekly hours from the totals', () => {
    expect(suggestedWeeklyHours(themes, 36)).toBe(2);
  });

  it('gives weeks in proportion to hours and skips holidays', () => {
    const rows = buildAnnualPlan(themes, { start: '2026-09-14', teachingWeeks: 8, weeklyHours: 2, holidays: ['2026-09-28'] });
    const weeks = rows.filter((r) => r.kind === 'week').map((r) => r.week!);
    expect(weeks.length).toBe(8);
    expect(rows.filter((r) => r.kind === 'holiday').length).toBe(1);
    expect(rows[2].kind).toBe('holiday');
    const byTheme = (o: number) => weeks.filter((w) => w.themeOrder === o).length;
    expect(byTheme(1)).toBe(4);
    expect(byTheme(2)).toBe(2);
    expect(byTheme(3)).toBe(2);
    // Every kazanım appears exactly once.
    expect(weeks.flatMap((w) => w.outcomes.map((o) => o.code))).toEqual(['M.1', 'M.2', 'M.3', 'M.4', 'G.1']);
    expect(weeks[0].keyConcepts).toEqual(['sayı']);
    expect(weeks[1].keyConcepts).toEqual([]);
  });

  it('writes a Word document', () => {
    const rows = buildAnnualPlan(themes, { start: '2026-09-14', teachingWeeks: 4, weeklyHours: 2, holidays: [] });
    const html = planToWordHtml(rows, { title: 'Plan', school: 'Atatürk İlkokulu', teacher: 'Ayşe', year: '2026-2027', subject: 'Matematik', grade: 1 });
    expect(html).toContain('ATATÜRK İLKOKULU');
    expect(html).toContain('M.1');
    expect(html).toContain('<table>');
  });
});
