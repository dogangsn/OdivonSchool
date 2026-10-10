/**
 * Generates questions with Gemini for many categories and writes them to Firestore.
 *
 * Kullanım:
 *   node scripts/batch-generate-all.js --apiKey=AIza... [filtreler] [seçenekler]
 *
 * Filtreler (birlikte kullanılabilir):
 *   --level=ilkokul|ortaokul|lise|kpss   sadece bu kademe
 *   --grade=3                            sadece bu sınıf
 *   --subject=Matematik                  sadece bu ders
 *   --category=<id>                      tek kategori
 *   --meb                                sadece MEB öğrenme çıktısı olan (yeni müfredat) kategoriler
 *
 * Seçenekler:
 *   --count=5        kategori başına soru (varsayılan 5)
 *   --min=10         zaten bu kadar sorusu olan kategoriyi atla (varsayılan 10, 0 = hiç atlama)
 *   --difficulty=3   1-5, 0 = karışık (varsayılan 0)
 *   --delay=4000     istekler arası bekleme (ms)
 *   --start=0        listede kaldığı yerden devam
 *   --draft          soruları onay masasına taslak olarak yaz (varsayılan: onaylı yayınla)
 *   --dry-run        hiçbir şey yazmadan hangi kategorilerin işleneceğini listele
 */
const { CATEGORIES } = require('./categories');
const { buildQuestionPrompt } = require('./question-prompt');
const {
  GEMINI_MODEL,
  readFirebaseToken,
  setDoc,
  countQuestions,
  callGemini,
  sleep,
} = require('./firebase-rest');

const opts = {
  apiKey: process.env.GEMINI_API_KEY || '',
  count: 5,
  min: 10,
  difficulty: 0,
  delay: 4000,
  start: 0,
  draft: false,
  dryRun: false,
  meb: false,
  level: '',
  grade: 0,
  subject: '',
  category: '',
};

for (const arg of process.argv.slice(2)) {
  const [key, value = ''] = arg.replace(/^--/, '').split('=');
  if (key === 'apiKey') opts.apiKey = value;
  else if (key === 'count') opts.count = parseInt(value, 10);
  else if (key === 'min') opts.min = parseInt(value, 10);
  else if (key === 'difficulty') opts.difficulty = parseInt(value, 10);
  else if (key === 'delay') opts.delay = parseInt(value, 10);
  else if (key === 'start') opts.start = parseInt(value, 10);
  else if (key === 'grade') opts.grade = parseInt(value, 10);
  else if (key === 'level') opts.level = value;
  else if (key === 'subject') opts.subject = value;
  else if (key === 'category') opts.category = value;
  else if (key === 'draft') opts.draft = true;
  else if (key === 'dry-run') opts.dryRun = true;
  else if (key === 'meb') opts.meb = true;
}

const targets = CATEGORIES.filter(
  (c) =>
    (!opts.category || c.id === opts.category) &&
    (!opts.level || c.level === opts.level) &&
    (!opts.grade || (c.grades || []).includes(opts.grade)) &&
    (!opts.subject || c.subject.toLocaleLowerCase('tr') === opts.subject.toLocaleLowerCase('tr')) &&
    (!opts.meb || (c.outcomes || []).length > 0)
);

function normalize(q, cat) {
  const options = (q.options || []).map((o) => ({
    id: String(o.id || '').toLowerCase().trim(),
    text: String(o.text || '').trim(),
  }));
  const correctOptionId = String(q.correctOptionId || '').toLowerCase().trim();
  if (!q.prompt || options.length !== 4 || !options.some((o) => o.id === correctOptionId) || !q.explanation) {
    return null;
  }
  const codes = (cat.outcomes || []).map((o) => o.code);
  const difficulty = Math.min(Math.max(parseInt(q.difficulty, 10) || opts.difficulty || 3, 1), 5);
  return {
    prompt: String(q.prompt).trim(),
    options,
    correctOptionId,
    explanation: String(q.explanation).trim(),
    difficulty,
    outcomeCode: codes.includes(q.outcomeCode) ? q.outcomeCode : undefined,
  };
}

async function main() {
  console.log(`\n🚀 OdivonSchool toplu soru üretici (${GEMINI_MODEL})`);
  console.log(`📊 ${targets.length} kategori seçildi | kategori başına ${opts.count} soru | ` +
    `${opts.draft ? 'taslak (onay masası)' : 'onaylı (canlı)'}\n`);

  if (opts.dryRun) {
    targets.forEach((c, i) => console.log(`${i + 1}. ${c.id} — ${c.subject} / ${c.topic}`));
    return;
  }
  if (!opts.apiKey) {
    console.error('❌ Gemini API anahtarı yok. --apiKey=... verin veya GEMINI_API_KEY ayarlayın.');
    process.exit(1);
  }

  const token = readFirebaseToken();
  let created = 0;

  for (let i = opts.start; i < targets.length; i++) {
    const cat = targets[i];
    console.log(`[${i + 1}/${targets.length}] ${cat.id} — ${cat.subject} / ${cat.topic}`);
    try {
      if (opts.min > 0) {
        const existing = await countQuestions(token, cat.id);
        if (existing >= opts.min) {
          console.log(`  ⏭  ${existing} soru zaten var, atlandı.`);
          continue;
        }
      }

      const raw = await callGemini(opts.apiKey, buildQuestionPrompt(cat, opts.count, opts.difficulty));
      const questions = raw.map((q) => normalize(q, cat)).filter(Boolean);
      const now = Date.now();

      for (let j = 0; j < questions.length; j++) {
        await setDoc(token, 'questions', `${cat.id}_ai_${now}_${j + 1}`, {
          ...questions[j],
          categoryId: cat.id,
          level: cat.level,
          subject: cat.subject,
          source: 'ai-generated',
          aiModel: GEMINI_MODEL,
          reviewStatus: opts.draft ? 'draft' : 'approved',
          createdAt: now,
          usageCount: 0,
          correctCount: 0,
        });
        created++;
      }
      console.log(`  ✅ ${questions.length}/${raw.length} geçerli soru yazıldı.`);
    } catch (err) {
      console.error(`  ❌ Hata: ${err.message}`);
      // Expired Firebase login or bad Gemini key: every later category would fail too.
      if (/UNAUTHENTICATED|API_KEY_INVALID/.test(err.message)) process.exit(1);
    }
    if (i < targets.length - 1) await sleep(opts.delay);
  }

  console.log(`\n🎉 Bitti. Toplam ${created} soru eklendi.`);
}

main().catch((err) => {
  console.error('\n❌ Genel hata:', err.message);
  process.exit(1);
});
