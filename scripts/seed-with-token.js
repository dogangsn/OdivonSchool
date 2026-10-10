/**
 * Writes categories (legacy + MEB Maarif Modeli temaları) and the sample
 * questions to Firestore using your `firebase login` session - no service
 * account key needed.
 *
 *   firebase projects:list        # refreshes the login token
 *   node scripts/seed-with-token.js [--categories-only]
 */
const { CATEGORIES } = require('./categories');
const { SAMPLE_QUESTIONS } = require('./questions');
const { readFirebaseToken, setDoc } = require('./firebase-rest');

const categoriesOnly = process.argv.includes('--categories-only');

async function seed() {
  const token = readFirebaseToken();

  console.log(`🚀 ${CATEGORIES.length} kategori Firestore'a yazılıyor...`);
  for (const cat of CATEGORIES) {
    await setDoc(token, 'categories', cat.id, cat);
    const grades = cat.grades?.length ? ` (${cat.grades.join(',')}. sınıf)` : '';
    console.log(`✔ [${cat.level}] ${cat.subject} - ${cat.topic}${grades}`);
  }

  if (categoriesOnly) {
    console.log('\n🎉 Kategoriler yazıldı.');
    return;
  }

  console.log(`\n🚀 Örnek sorular ekleniyor...`);
  for (const [categoryId, questions] of Object.entries(SAMPLE_QUESTIONS)) {
    const cat = CATEGORIES.find((c) => c.id === categoryId);
    if (!cat) continue;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await setDoc(token, 'questions', `${categoryId}_q${i + 1}`, {
        ...q,
        categoryId,
        level: cat.level,
        subject: cat.subject,
        source: 'manual',
        reviewStatus: 'approved',
        createdAt: Date.now(),
        usageCount: 0,
        correctCount: 0,
      });
      console.log(`✔ Soru [${categoryId}_q${i + 1}]: "${q.prompt.substring(0, 35)}..."`);
    }
  }

  console.log('\n🎉 Seed işlemi başarıyla tamamlandı!');
}

seed().catch((err) => {
  console.error('Seed hatası:', err.message);
  process.exit(1);
});
