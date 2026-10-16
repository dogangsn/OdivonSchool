/**
 * Minimal Firestore REST + Gemini helpers shared by the CLI scripts.
 * Auth uses the access token that `firebase login` stores locally, so run any
 * firebase command first (e.g. `firebase projects:list`) to refresh it.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');

const PROJECT_ID = 'odivonschool';
// Override with GEMINI_MODEL (e.g. gemini-3.5-flash-lite for a cheaper model).
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

let cachedToken = null;

/**
 * Access token for the Firestore REST API. In CI, FIREBASE_TOKEN_COMMAND (e.g.
 * `gcloud auth print-access-token`) is re-run every 30 minutes so long runs
 * outlive the 1-hour token; otherwise the local `firebase login` token is used.
 */
function readFirebaseToken() {
  const command = process.env.FIREBASE_TOKEN_COMMAND;
  if (command) {
    if (!cachedToken || Date.now() - cachedToken.at > 30 * 60 * 1000) {
      const value = require('child_process').execSync(command, { encoding: 'utf8' }).trim();
      cachedToken = { value, at: Date.now() };
    }
    return cachedToken.value;
  }
  const configPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`firebase-tools.json bulunamadı: ${configPath} (önce "firebase login" çalıştırın)`);
  }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const token = config.tokens?.access_token;
  if (!token) throw new Error('Firebase access token bulunamadı. "firebase login" çalıştırın.');
  return token;
}

function firestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: val.toString() };
    return { doubleValue: val };
  }
  if (typeof val === 'boolean') return { booleanValue: val };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(firestoreValue) } };
  const fields = {};
  for (const [k, v] of Object.entries(val)) {
    if (v !== undefined) fields[k] = firestoreValue(v);
  }
  return { mapValue: { fields } };
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
          } catch {
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

function firestoreRequest(token, method, docPath, body) {
  return request(
    {
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents${docPath}`,
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    },
    body
  );
}

/** Creates or overwrites a document. */
function setDoc(token, collection, id, data) {
  return firestoreRequest(token, 'PATCH', `/${collection}/${encodeURIComponent(id)}`, {
    fields: firestoreValue(data).mapValue.fields,
  });
}

/** Number of questions in a category (any review status except rejected). */
async function countQuestions(token, categoryId) {
  const res = await firestoreRequest(token, 'POST', ':runAggregationQuery', {
    structuredAggregationQuery: {
      structuredQuery: {
        from: [{ collectionId: 'questions' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'categoryId' },
            op: 'EQUAL',
            value: { stringValue: categoryId },
          },
        },
      },
      aggregations: [{ alias: 'n', count: {} }],
    },
  });
  return Number(res?.[0]?.result?.aggregateFields?.n?.integerValue ?? 0);
}

async function callGemini(apiKey, prompt) {
  const res = await request(
    {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, responseMimeType: 'application/json' },
    }
  );
  const rawText = res?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('Gemini API boş yanıt döndürdü.');
  const clean = rawText.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(clean);
  return Array.isArray(parsed) ? parsed : parsed.questions || parsed.data || [];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = {
  PROJECT_ID,
  GEMINI_MODEL,
  readFirebaseToken,
  setDoc,
  countQuestions,
  callGemini,
  sleep,
};
