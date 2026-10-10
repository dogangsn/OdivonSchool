/**
 * Tek kategori için soru üretir. batch-generate-all.js'in kısayoludur:
 *   node scripts/generate-questions.js --apiKey=AIza... --category=<id> [--count=5] [--difficulty=2] [--draft]
 * Varsayılan olarak mevcut soru sayısına bakmadan üretir (--min=0).
 */
if (!process.argv.some((a) => a.startsWith('--category='))) {
  console.error('❌ --category=<kategori-id> gerekli. Kategoriler: scripts/categories.js');
  process.exit(1);
}
if (!process.argv.some((a) => a.startsWith('--min='))) process.argv.push('--min=0');
require('./batch-generate-all');
