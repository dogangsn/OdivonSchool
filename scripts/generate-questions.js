const fs = require('fs');
const path = require('path');
const https = require('https');
const { CATEGORIES } = require('./categories');

// Read Firebase token from configstore
const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
if (!fs.existsSync(configPath)) {
  console.error('firebase-tools.json bulunamadı:', configPath);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const firebaseToken = config.tokens?.access_token;
if (!firebaseToken) {
  console.error('Firebase access token bulunamadı.');
  process.exit(1);
}

// Parse CLI Arguments
const args = process.argv.slice(2);
let categoryId = 'ortaokul-matematik-carpanlar-katlar';
let count = 5;
let apiKey = process.env.GEMINI_API_KEY || '';
let difficulty = 2;
let autoApprove = true;

for (const arg of args) {
  if (arg.startsWith('--category=')) categoryId = arg.split('=')[1];
  if (arg.startsWith('--count=')) count = parseInt(arg.split('=')[1], 10);
  if (arg.startsWith('--apiKey=')) apiKey = arg.split('=')[1];
  if (arg.startsWith('--difficulty=')) difficulty = parseInt(arg.split('=')[1], 10);
  if (arg.startsWith('--draft')) autoApprove = false;
}

if (!apiKey) {
  console.error('\n❌ Hata: Gemini API anahtarı belirtilmedi.');
  console.log('Kullanım: node scripts/generate-questions.js --apiKey=AIzaSy... [--category=kategori-id] [--count=5] [--difficulty=2] [--draft]\n');
  process.exit(1);
}

const targetCategory = CATEGORIES.find((c) => c.id === categoryId);
if (!targetCategory) {
  console.error(`❌ Hata: '${categoryId}' kategorisi bulunamadı.`);
  console.log('Geçerli kategoriler için scripts/categories.js dosyasını inceleyin.');
  process.exit(1);
}

function firestoreValue(val) {
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: val.toString() };
    return { doubleValue: val };
  }
  if (typeof val === 'boolean') return { booleanValue: val };
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map((item) => firestoreValue(item)),
      },
    };
  }
  if (typeof val === 'object' && val !== null) {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = firestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { nullValue: null };
}

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(data ? JSON.parse(data) : {});
          } catch (e) {
            resolve(data);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function callGemini(category, count, difficulty) {
  const prompt = `
Sen Türkiye Cumhuriyeti MEB ve ÖSYM sınav standartlarına tam hakim, uzman bir soru yazarısın.
Eğitim Kademesi: "${category.level.toUpperCase()}"
Ders: "${category.subject}"
Ana Konu: "${category.topic}"
Hedef Zorluk Düzeyi: ${difficulty}/5
Soru Sayısı: ${count} adet

GÖREV:
Bu konuya ait, güncel müfredat kazanımlarına %100 uygun, yüksek kaliteli, çoktan seçmeli ${count} adet soru hazırla.

KESİN KURALLAR:
1. Her soruda TAM OLARAK 4 seçenek olmalı: "a", "b", "c", "d".
2. "correctOptionId" mutlak surette "a", "b", "c" veya "d" değerlerinden biri olmalı.
3. Çeldiriciler (yanlış şıklar) öğrencinin yapabileceği tipik işlem hatalarına veya kavram yanılgılarına uygun, gerçekçi olmalı.
4. "explanation" (Çözüm Açıklaması) çok önemlidir: Öğrenci soruyu yanlış yaptığında konuyu eksiksiz öğrenebilsin. Doğru cevaba nasıl ulaşıldığını, formülü veya kuralı adım adım, samimi ve anlaşılır bir dille anlat.
5. Sadece ve sadece aşağıdaki JSON şemasına uyan JSON dizisi (array) döndür.

JSON ŞEMASI:
[
  {
    "prompt": "Soru metni",
    "options": [
      { "id": "a", "text": "A şıkkı" },
      { "id": "b", "text": "B şıkkı" },
      { "id": "c", "text": "C şıkkı" },
      { "id": "d", "text": "D şıkkı" }
    ],
    "correctOptionId": "a",
    "explanation": "Detaylı çözüm açıklaması",
    "difficulty": ${difficulty}
  }
]
`.trim();

  const options = {
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  };

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      responseMimeType: 'application/json',
    },
  };

  const res = await request(options, body);
  const rawText = res?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('Gemini API boş yanıt döndürdü.');

  return JSON.parse(rawText);
}

async function main() {
  console.log(`\n🚀 [OdivonSchool AI Soru Üretici] Başlatılıyor...`);
  console.log(`📌 Kategori: [${targetCategory.level}] ${targetCategory.subject} - ${targetCategory.topic}`);
  console.log(`🔢 Adet: ${count} Soru | Zorluk: ${difficulty}/5 | Durum: ${autoApprove ? 'Canlı (Approved)' : 'Taslak (Draft)'}`);

  console.log(`\n⚡ Google Gemini 2.0 Flash ile sorular üretiliyor...`);
  const questions = await callGemini(targetCategory, count, difficulty);
  console.log(`✔ ${questions.length} adet soru başarıyla üretildi!`);

  const projectId = 'odivonschool';
  console.log(`\n💾 Sorular Firestore veritabanına yazılıyor...`);

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const timestamp = Date.now();
    const docId = `${categoryId}_ai_${timestamp}_${i + 1}`;

    const qDoc = {
      categoryId,
      level: targetCategory.level,
      subject: targetCategory.subject,
      prompt: q.prompt,
      options: q.options,
      correctOptionId: q.correctOptionId,
      explanation: q.explanation,
      difficulty: q.difficulty || difficulty,
      source: 'gemini-2.0-flash',
      reviewStatus: autoApprove ? 'approved' : 'draft',
      createdAt: timestamp,
      usageCount: 0,
      correctCount: 0,
    };

    const fields = {};
    for (const [k, v] of Object.entries(qDoc)) {
      fields[k] = firestoreValue(v);
    }

    const docPath = `/v1/projects/${projectId}/databases/(default)/documents/questions/${docId}`;
    await request(
      {
        hostname: 'firestore.googleapis.com',
        path: docPath,
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${firebaseToken}`,
          'Content-Type': 'application/json',
        },
      },
      { fields }
    );

    console.log(`  [${i + 1}/${questions.length}] ✔ Eklendi: "${q.prompt.substring(0, 45)}..."`);
  }

  console.log(`\n🎉 İşlem tamamlandı! Sorular veritabanında aktif.`);
}

main().catch((err) => {
  console.error('\n❌ Hata:', err.message);
  process.exit(1);
});
