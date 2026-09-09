/**
 * One-off / re-runnable seed script for OdivonSchool.
 *
 * Usage:
 *   1. In Firebase Console > Project settings > Service accounts,
 *      generate a new private key and save it as scripts/serviceAccountKey.json
 *      (this file is gitignored - never commit it).
 *   2. cd scripts && npm install
 *   3. node seed.js
 *
 * Safe to run multiple times: categories use fixed slug IDs, so re-running
 * just overwrites them with the same data. Questions are only added if a
 * question with the same prompt doesn't already exist for that category,
 * so re-running won't create duplicates.
 */
const admin = require('firebase-admin');
const path = require('path');
const { CATEGORIES } = require('./categories');
const { SAMPLE_QUESTIONS } = require('./questions');

const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function seedCategories() {
  const batch = db.batch();
  for (const category of CATEGORIES) {
    const ref = db.collection('categories').doc(category.id);
    batch.set(ref, category);
  }
  await batch.commit();
  console.log(`✔ ${CATEGORIES.length} kategori yazıldı.`);
}

async function seedQuestions() {
  let created = 0;
  let skipped = 0;

  for (const [categoryId, questions] of Object.entries(SAMPLE_QUESTIONS)) {
    const category = CATEGORIES.find((c) => c.id === categoryId);
    if (!category) {
      console.warn(`⚠ ${categoryId} categories.js içinde bulunamadı, atlanıyor.`);
      continue;
    }

    for (const q of questions) {
      const existing = await db
        .collection('questions')
        .where('categoryId', '==', categoryId)
        .where('prompt', '==', q.prompt)
        .limit(1)
        .get();

      if (!existing.empty) {
        skipped++;
        continue;
      }

      await db.collection('questions').add({
        ...q,
        categoryId,
        level: category.level,
        subject: category.subject,
        source: 'manual',
        reviewStatus: 'approved',
        createdAt: Date.now(),
        usageCount: 0,
        correctCount: 0,
      });
      created++;
    }
  }

  console.log(`✔ ${created} yeni soru eklendi, ${skipped} soru zaten vardı (atlandı).`);
}

async function main() {
  await seedCategories();
  await seedQuestions();
  console.log('Seed işlemi tamamlandı.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed işlemi başarısız:', err);
  process.exit(1);
});
