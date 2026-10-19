/**
 * Builds the Defter Notları data served from /defter/*.json.
 *
 * Inputs:
 *   scripts/mufredat/<file>.json  MEB programs (temalar, kazanımlar)
 *   scripts/defter/<file>.json    konu anlatımlı özetler, one note per (grade, order)
 *
 * Output (gitignored, rebuilt on every start/build/test):
 *   public/defter/index.json      light list for the Defter Notları page
 *   public/defter/<file>.json     full notes of one level + subject, keyed by slug
 *
 * Slug: "4-sinif-fen-bilimleri-maddenin-halleri" (sınıf + ders + tema).
 */
const fs = require('fs');
const path = require('path');
const { slugify } = require('./meb-categories');

const MUFREDAT = path.join(__dirname, 'mufredat');
const NOTES = path.join(__dirname, 'defter');
const OUT = path.join(__dirname, '..', 'public', 'defter');

const LEVEL_ORDER = ['ilkokul', 'ortaokul', 'lise'];

/** "4. Tema: Sayılar Ve Nicelikler (1)" -> "Sayılar ve Nicelikler (1)" */
function tidyName(name) {
  return name
    .replace(/\s+/g, ' ')
    .replace(/^\s*\d+\.\s*(Tema|Ünite|Öğrenme Alanı)\s*:\s*/i, '')
    .replace(/^\s*Theme\s+\d+\s*:\s*/i, '')
    .replace(/ (Ve|İle|Ile) /g, (m) => m.toLocaleLowerCase('tr'))
    .trim();
}

/** English theme names arrive with Turkish casing ("Lıfe İn Nature"). */
function englishTitle(name) {
  const small = new Set(['in', 'the', 'and', 'of', 'at']);
  return tidyName(name)
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'I')
    .split(' ')
    .map((w, i) => (i > 0 && small.has(w.toLowerCase()) ? w.toLowerCase() : w))
    .join(' ');
}

function build() {
  fs.mkdirSync(OUT, { recursive: true });
  const index = [];
  const slugs = new Set();
  let written = 0;
  let missing = 0;

  const files = fs.readdirSync(MUFREDAT).filter((f) => f.endsWith('.json')).sort();
  for (const name of files) {
    const file = name.replace(/\.json$/, '');
    const program = JSON.parse(fs.readFileSync(path.join(MUFREDAT, name), 'utf8'));
    const notePath = path.join(NOTES, name);
    const notes = fs.existsSync(notePath) ? JSON.parse(fs.readFileSync(notePath, 'utf8')).notes || [] : [];
    const byKey = new Map(notes.map((n) => [`${n.grade}-${n.order}`, n]));
    const subjectSlug = slugify(program.subject);
    const full = {};

    for (const g of program.grades || []) {
      for (const theme of g.themes || []) {
        const title = program.subject === 'İngilizce' ? englishTitle(theme.name) : tidyName(theme.name);
        let slug = `${g.grade}-sinif-${subjectSlug}-${slugify(title)}`;
        if (slugs.has(slug)) slug = `${slug}-${theme.order}`;
        slugs.add(slug);

        const note = byKey.get(`${g.grade}-${theme.order}`) || null;
        if (note) written++;
        else missing++;
        const hasOutcomes = (theme.outcomes || []).length > 0;

        index.push({
          slug,
          file,
          level: program.level,
          grade: g.grade,
          subject: program.subject,
          order: theme.order,
          title,
          intro: note ? note.intro : '',
          hasNote: !!note,
        });
        full[slug] = {
          slug,
          level: program.level,
          grade: g.grade,
          subject: program.subject,
          order: theme.order,
          title,
          hours: theme.hours || null,
          sourceUrl: theme.url || g.gradeUrl || program.programUrl || null,
          // Same id scripts/meb-categories.js gives the theme's test category.
          categoryId: hasOutcomes ? `${program.level}-${g.grade}-${subjectSlug}-t${theme.order}` : null,
          keyConcepts: theme.keyConcepts || [],
          outcomes: (theme.outcomes || []).map((o) => ({ code: o.code, text: o.text })),
          note: note
            ? {
                intro: note.intro,
                sections: note.sections || [],
                keyTerms: note.keyTerms || [],
                example: note.example || null,
                remember: note.remember || [],
              }
            : null,
        };
      }
    }
    fs.writeFileSync(path.join(OUT, `${file}.json`), JSON.stringify(full));
  }

  index.sort(
    (a, b) =>
      LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) ||
      a.grade - b.grade ||
      a.subject.localeCompare(b.subject, 'tr') ||
      a.order - b.order
  );
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index));
  console.log(`Defter notları: ${written} not, ${missing} tema notsuz, ${index.length} tema.`);
}

build();
