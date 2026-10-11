/**
 * Builds test categories from the MEB Türkiye Yüzyılı Maarif Modeli programs
 * extracted into scripts/mufredat/*.json (one file per level + subject, from
 * https://tymm.meb.gov.tr/ogretim-programlari).
 *
 * Each (level, grade, subject, tema) becomes one category, e.g.
 *   ilkokul-3-matematik-t3  ->  3. Sınıf Matematik, "İşlemlerden Cebirsel Düşünmeye"
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'mufredat');

// Display order of subjects inside a level.
const SUBJECT_ORDER = [
  'Türkçe',
  'Türk Dili ve Edebiyatı',
  'Matematik',
  'Hayat Bilgisi',
  'Fen Bilimleri',
  'Fizik',
  'Kimya',
  'Biyoloji',
  'Sosyal Bilgiler',
  'T.C. İnkılap Tarihi ve Atatürkçülük',
  'Tarih',
  'Coğrafya',
  'İngilizce',
];

function slugify(text) {
  return text
    .toLocaleLowerCase('tr')
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
    .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').replace(/â/g, 'a').replace(/î/g, 'i')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** "4. Tema: Sayılar Ve Nicelikler (1)" -> "Sayılar ve Nicelikler (1)" */
function tidyName(name) {
  return name
    .replace(/\s+/g, ' ')
    .replace(/^\s*\d+\.\s*(Tema|Ünite|Öğrenme Alanı)\s*:\s*/i, '').replace(/ (Ve|İle|Ile) /g, (m) => m.toLocaleLowerCase('tr')).trim();
}

function describe(theme) {
  const text = (theme.outcomes || [])
    .map((o, i) => {
      const t = o.text.replace(/\.$/, '');
      return i === 0 ? t : t.charAt(0).toLocaleLowerCase('tr') + t.slice(1);
    })
    .join('; ');
  return text.length > 180 ? `${text.slice(0, 177).replace(/[;,\s]+\S*$/, '')}...` : text;
}

function loadMebCategories() {
  if (!fs.existsSync(DIR)) return [];
  const categories = [];
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();

  for (const file of files) {
    const program = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
    const subjectRank = SUBJECT_ORDER.indexOf(program.subject);
    const subjectBase = (subjectRank === -1 ? SUBJECT_ORDER.length : subjectRank) * 1000;
    const subjectSlug = slugify(program.subject);

    for (const g of program.grades || []) {
      for (const theme of g.themes || []) {
        if (!(theme.outcomes || []).length) continue;
        categories.push({
          id: `${program.level}-${g.grade}-${subjectSlug}-t${theme.order}`,
          level: program.level,
          subject: program.subject,
          topic: tidyName(theme.name),
          description: describe(theme),
          order: 100000 + subjectBase + g.grade * 50 + theme.order,
          grades: [g.grade],
          outcomes: theme.outcomes.map((o) => ({ code: o.code, text: o.text })),
          sourceUrl: theme.url || g.gradeUrl || program.programUrl,
        });
      }
    }
  }
  return categories;
}

module.exports = { loadMebCategories, slugify };
