/**
 * Yıllık plan: spreads a sınıf's temas over the school weeks in proportion to
 * their ders saati, and spreads each tema's kazanımlar over its weeks.
 */
export interface PlanTheme {
  order: number;
  title: string;
  hours: number | null;
  keyConcepts: string[];
  outcomes: { code: string; text: string }[];
}

export interface PlanWeek {
  /** 1-based teaching week. */
  week: number;
  /** Monday, YYYY-MM-DD */
  start: string;
  /** Friday, YYYY-MM-DD */
  end: string;
  month: string;
  hours: number;
  themeOrder: number;
  themeTitle: string;
  /** True for the tema's first week (concepts are printed there). */
  themeStart: boolean;
  outcomes: { code: string; text: string }[];
  keyConcepts: string[];
}

export interface PlanRow {
  kind: 'week' | 'holiday';
  start: string;
  end: string;
  month: string;
  week?: PlanWeek;
  label?: string;
}

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

export function parseDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = parseDay(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDay(d);
}

/** The Monday of the week that contains `iso`. */
export function mondayOf(iso: string): string {
  const d = parseDay(iso);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  return addDays(iso, -dow);
}

export function monthName(iso: string): string {
  return MONTHS[parseDay(iso).getUTCMonth()];
}

/** "14.09" */
export function shortDay(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}.${m}`;
}

/** Ders saati per week, rounded, from the tema totals over `weeks` weeks. */
export function suggestedWeeklyHours(themes: readonly PlanTheme[], weeks: number): number {
  const total = themes.reduce((n, t) => n + (t.hours ?? 0), 0);
  if (total <= 0) return 2;
  return Math.max(1, Math.round(total / Math.max(1, weeks)));
}

export interface PlanOptions {
  /** First school day (any day of that week). */
  start: string;
  teachingWeeks: number;
  weeklyHours: number;
  /** Mondays of holiday weeks (YYYY-MM-DD). */
  holidays: string[];
  /** Labels for the holiday rows, by Monday. */
  holidayLabels?: Record<string, string>;
}

export function buildAnnualPlan(themes: readonly PlanTheme[], opts: PlanOptions): PlanRow[] {
  const weeksCount = Math.max(1, Math.min(52, Math.floor(opts.teachingWeeks)));
  const holidays = new Set(opts.holidays.map(mondayOf));
  const sorted = [...themes].sort((a, b) => a.order - b.order);

  // Tema weight: its hours, or an even share when the program gives none.
  const known = sorted.filter((t) => (t.hours ?? 0) > 0);
  const fallback = known.length ? known.reduce((n, t) => n + (t.hours ?? 0), 0) / known.length : 1;
  const weights = sorted.map((t) => ((t.hours ?? 0) > 0 ? t.hours! : fallback));
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;

  // Each tema gets at least one week; the rest goes by weight (largest remainder).
  const themeWeeks = sorted.map(() => 0);
  if (sorted.length > 0) {
    const base = weeksCount >= sorted.length ? 1 : 0;
    let left = weeksCount - base * sorted.length;
    const exact = weights.map((w) => (w / totalWeight) * left);
    exact.forEach((e, i) => {
      themeWeeks[i] = base + Math.floor(e);
    });
    left -= exact.reduce((n, e) => n + Math.floor(e), 0);
    const order = exact.map((e, i) => [e - Math.floor(e), i] as const).sort((a, b) => b[0] - a[0]);
    for (let k = 0; k < left; k++) themeWeeks[order[k % order.length][1]]++;
  }

  // Walk the calendar.
  const rows: PlanRow[] = [];
  let monday = mondayOf(opts.start);
  let teaching = 0;
  let themeIdx = 0;
  let weekInTheme = 0;
  let guard = 0;
  while (teaching < weeksCount && guard++ < 80) {
    const friday = addDays(monday, 4);
    if (holidays.has(monday)) {
      rows.push({ kind: 'holiday', start: monday, end: friday, month: monthName(monday), label: opts.holidayLabels?.[monday] ?? 'Tatil' });
    } else {
      while (themeIdx < sorted.length - 1 && weekInTheme >= themeWeeks[themeIdx]) {
        themeIdx++;
        weekInTheme = 0;
      }
      const theme = sorted[themeIdx];
      const span = Math.max(1, themeWeeks[themeIdx] ?? 1);
      const outs = theme ? chunk(theme.outcomes, span)[Math.min(weekInTheme, span - 1)] ?? [] : [];
      teaching++;
      rows.push({
        kind: 'week',
        start: monday,
        end: friday,
        month: monthName(monday),
        week: {
          week: teaching,
          start: monday,
          end: friday,
          month: monthName(monday),
          hours: opts.weeklyHours,
          themeOrder: theme?.order ?? 0,
          themeTitle: theme?.title ?? '',
          themeStart: weekInTheme === 0,
          outcomes: outs,
          keyConcepts: weekInTheme === 0 ? theme?.keyConcepts ?? [] : [],
        },
      });
      weekInTheme++;
    }
    monday = addDays(monday, 7);
  }
  return rows;
}

/** Splits items into `parts` consecutive, nearly equal chunks. */
export function chunk<T>(items: readonly T[], parts: number): T[][] {
  const n = Math.max(1, parts);
  const out: T[][] = Array.from({ length: n }, () => []);
  items.forEach((item, i) => out[Math.min(n - 1, Math.floor((i * n) / items.length))].push(item));
  return out;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A Word-openable (.doc) HTML document of the plan. */
export function planToWordHtml(
  rows: readonly PlanRow[],
  meta: { title: string; school: string; teacher: string; year: string; subject: string; grade: number }
): string {
  const body = rows
    .map((r) => {
      const dates = `${shortDay(r.start)} - ${shortDay(r.end)}`;
      if (r.kind === 'holiday') {
        return `<tr><td>${esc(r.month)}</td><td>${dates}</td><td colspan="4" style="text-align:center;background:#fef3c7"><b>${esc(r.label ?? 'Tatil')}</b></td></tr>`;
      }
      const w = r.week!;
      const outs = w.outcomes.map((o) => `<b>${esc(o.code)}</b> ${esc(o.text)}`).join('<br>');
      return `<tr><td>${esc(r.month)}</td><td>${w.week}. hafta<br>${dates}</td><td style="text-align:center">${w.hours}</td><td>${esc(w.themeOrder + '. ' + w.themeTitle)}</td><td>${outs || '—'}</td><td>${esc(w.keyConcepts.join(', '))}</td></tr>`;
    })
    .join('\n');
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>${esc(meta.title)}</title>
<style>body{font-family:Calibri,Arial,sans-serif;font-size:10pt}table{border-collapse:collapse;width:100%}td,th{border:1px solid #444;padding:4px;vertical-align:top}th{background:#e0e7ff}h1{font-size:14pt;text-align:center}p.meta{text-align:center}</style>
</head><body>
<h1>${esc(meta.year)} EĞİTİM-ÖĞRETİM YILI ${esc(meta.school.toLocaleUpperCase('tr'))}<br>${meta.grade}. SINIF ${esc(meta.subject.toLocaleUpperCase('tr'))} DERSİ ÜNİTELENDİRİLMİŞ YILLIK PLANI</h1>
<table><thead><tr><th>Ay</th><th>Hafta</th><th>Saat</th><th>Tema / Ünite</th><th>Öğrenme Çıktıları (Kazanımlar)</th><th>Kavramlar</th></tr></thead>
<tbody>
${body}
</tbody></table>
<p class="meta"><br>Bu plan Türkiye Yüzyılı Maarif Modeli öğretim programındaki tema ve ders saatlerine göre hazırlanmıştır.</p>
<table style="border:none;margin-top:30px"><tr><td style="border:none;text-align:center">${esc(meta.teacher || '......................')}<br>Sınıf / Ders Öğretmeni</td><td style="border:none;text-align:center">......................<br>Okul Müdürü<br>Uygundur</td></tr></table>
</body></html>`;
}
