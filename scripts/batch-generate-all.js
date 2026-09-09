const fs = require('fs');
const path = require('path');
const https = require('https');
const { CATEGORIES } = require('./categories');

// Read Firebase token from configstore
const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
if (!fs.existsSync(configPath)) {
  console.error('❌ firebase-tools.json bulunamadı:', configPath);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const firebaseToken = config.tokens?.access_token;
if (!firebaseToken) {
  console.error('❌ Firebase access token bulunamadı.');
  process.exit(1);
}

// Parse CLI Arguments
const args = process.argv.slice(2);
let count = 3;
let apiKey = process.env.GEMINI_API_KEY || '';
let difficulty = 3;
let autoApprove = true;
let delayMs = 4000;
let startIndex = 0;

for (const arg of args) {
  if (arg.startsWith('--apiKey=')) apiKey = arg.split('=')[1];
  if (arg.startsWith('--count=')) count = parseInt(arg.split('=')[1], 10);
  if (arg.startsWith('--difficulty=')) difficulty = parseInt(arg.split('=')[1], 10);
  if (arg.startsWith('--delay=')) delayMs = parseInt(arg.split('=')[1], 10);
  if (arg.startsWith('--start=')) startIndex = parseInt(arg.split('=')[1], 10);
  if (arg.startsWith('--draft')) autoApprove = false;
}

if (!apiKey) {
  console.error('\n❌ Hata: Gemini API anahtarı belirtilmedi.');
  console.log('Kullanım: node scripts/batch-generate-all.js --apiKey=AIzaSy... [--count=3] [--delay=4000] [--start=0] [--draft]\n');
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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

  let cleanText = rawText.trim();
  if (cleanText.startsWith('```json')) {
    cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  const parsed = JSON.parse(cleanText);
  return Array.isArray(parsed) ? parsed : (parsed.questions || parsed.data || []);
}

async function main() {
  console.log(`\n======================================================`);
  console.log(`🚀 [OdivonSchool 77 Kategori Toplu Soru Üretici]`);
  console.log(`======================================================`);
  console.log(`📊 Toplam Kategori Sayısı: ${CATEGORIES.length}`);
  console.log(`🎯 Kategori Başına: ${count} Soru | Bekleme: ${delayMs}ms`);
  console.log(`Durum: ${autoApprove ? 'Canlıda (Approved)' : 'Onay Masasında (Draft)'}`);
  console.log(`======================================================\n`);

  const projectId = 'odivonschool';
  let totalCreated = 0;

  for (let cIdx = startIndex; cIdx < CATEGORIES.length; cIdx++) {
    const cat = CATEGORIES[cIdx];
    const categoryId = cat.id;

    console.log(`\n[${cIdx + 1}/${CATEGORIES.length}] ⚙️ Üretiliyor: [${cat.level.toUpperCase()}] ${cat.subject} - ${cat.topic}`);

    try {
      const questions = await callGemini(cat, count, difficulty);
      console.log(`  ✔ Gemini ${questions.length} soru üretti. Firestore'a yazılıyor...`);

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const timestamp = Date.now();
        const docId = `${categoryId}_ai_${timestamp}_${i + 1}`;

        const normalizedCorrect = (q.correctOptionId || 'a').toLowerCase().trim();
        const normalizedOptions = (q.options || []).map((o) => ({
          id: (o.id || '').toLowerCase().trim(),
          text: (o.text || '').trim(),
        }));

        const qDoc = {
          categoryId,
          level: cat.level,
          subject: cat.subject,
          prompt: q.prompt,
          options: normalizedOptions,
          correctOptionId: normalizedCorrect,
          explanation: q.explanation,
          difficulty: q.difficulty || difficulty,
          source: 'ai-generated',
          aiModel: 'gemini-2.0-flash',
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
        totalCreated++;
      }

      console.log(`  ✅ Başarılı! Kategori tamamlandı.`);
    } catch (err) {
      console.error(`  ❌ Hata (${cat.id}):`, err.message);
    }

    if (cIdx < CATEGORIES.length - 1) {
      await sleep(delayMs);
    }
  }

  console.log(`\n🎉 BÜTÜN İŞLEM TAMAMLANDI! Toplam ${totalCreated} adet soru eklendi.`);
}

main().catch((err) => {
  console.error('\n❌ Genel Hata:', err.message);
  process.exit(1);
});
