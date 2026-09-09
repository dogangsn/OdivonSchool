const fs = require('fs');
const path = require('path');
const https = require('https');
const { CATEGORIES } = require('./categories');
const { SAMPLE_QUESTIONS } = require('./questions');

// 1. Read token from configstore
const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
if (!fs.existsSync(configPath)) {
  console.error('firebase-tools.json bulunamadı:', configPath);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const userTokens = config.tokens;

async function getAccessToken() {
  if (userTokens.access_token) {
    return userTokens.access_token;
  }
  throw new Error('No access_token found in configstore');
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

async function seed() {
  const token = await getAccessToken();
  const projectId = 'odivonschool';

  console.log(`🚀 ${CATEGORIES.length} kategori Firestore'a yazılıyor...`);

  for (const cat of CATEGORIES) {
    const fields = {};
    for (const [k, v] of Object.entries(cat)) {
      fields[k] = firestoreValue(v);
    }

    const docPath = `/v1/projects/${projectId}/databases/(default)/documents/categories/${cat.id}`;
    await request(
      {
        hostname: 'firestore.googleapis.com',
        path: docPath,
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
      { fields }
    );
    console.log(`✔ Kategori eklendi: [${cat.level}] ${cat.subject} - ${cat.topic}`);
  }

  console.log(`\n🚀 Örnek sorular ekleniyor...`);
  for (const [categoryId, questions] of Object.entries(SAMPLE_QUESTIONS)) {
    const cat = CATEGORIES.find((c) => c.id === categoryId);
    if (!cat) continue;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const docId = `${categoryId}_q${i + 1}`;
      const qDoc = {
        ...q,
        categoryId,
        level: cat.level,
        subject: cat.subject,
        source: 'manual',
        reviewStatus: 'approved',
        createdAt: Date.now(),
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
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
        { fields }
      );
      console.log(`✔ Soru eklendi [${docId}]: ${cat.subject} - "${q.prompt.substring(0, 35)}..."`);
    }
  }

  console.log('\n🎉 Seed işlemi başarıyla tamamlandı!');
}

seed().catch(async (err) => {
  console.error('Seed hatası:', err.message);
  process.exit(1);
});
