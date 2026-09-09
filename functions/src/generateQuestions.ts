import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { callLLM, geminiApiKey, AI_MODEL_NAME } from './aiProvider';
import { GeneratedQuestion, QuestionDoc } from './types';

interface GenerateQuestionsRequest {
  categoryId: string;
  count?: number; // default 5, max 20 per call to keep cost/latency sane
}

function buildPrompt(level: string, subject: string, topic: string, count: number): string {
  return `
Sen Türkiye müfredatına uygun, "${level}" seviyesi için "${subject}" dersinde
"${topic}" konusunda çoktan seçmeli test sorusu hazırlayan bir eğitim uzmanısın.

Görev: Aşağıdaki JSON şemasına birebir uyan, ${count} adet soru üret.
Kurallar:
- Her sorunun tam olarak 4 seçeneği olsun (id: "a","b","c","d").
- "correctOptionId" seçeneklerden birinin id'si olmalı.
- "explanation" alanı, öğrenci YANLIŞ cevap verdiğinde gösterilecek öğretici bir
  açıklama olmalı: doğru cevabın neden doğru olduğunu, ilgili kısa kuralı veya
  çözüm yolunu anlatsın.
- "difficulty" 1 (çok kolay) ile 5 (çok zor) arası bir tam sayı olsun.
- Sadece geçerli JSON döndür, başka hiçbir metin ekleme.

JSON şeması (dizi olarak döndür):
[
  {
    "prompt": "string",
    "options": [{"id":"a","text":"string"}, {"id":"b","text":"string"}, {"id":"c","text":"string"}, {"id":"d","text":"string"}],
    "correctOptionId": "a" | "b" | "c" | "d",
    "explanation": "string",
    "difficulty": 1
  }
]
`.trim();
}

function validateGenerated(items: unknown): GeneratedQuestion[] {
  if (!Array.isArray(items)) throw new Error('AI response is not an array');
  return items.map((raw, i) => {
    const q = raw as GeneratedQuestion;
    if (!q.prompt || !Array.isArray(q.options) || q.options.length < 2) {
      throw new Error(`Question ${i} is missing prompt/options`);
    }
    if (!q.options.some((o) => o.id === q.correctOptionId)) {
      throw new Error(`Question ${i} has correctOptionId not present in options`);
    }
    if (!q.explanation) {
      throw new Error(`Question ${i} is missing explanation`);
    }
    return q;
  });
}

/**
 * Callable Cloud Function - generates draft questions for a category using
 * an LLM, and stores them with reviewStatus: 'draft'. Only admins may call
 * this (checked against the caller's Firestore user doc). Drafts must be
 * approved via approveQuestion before they are served to students.
 */
export const generateQuestions = onCall(
  { secrets: [geminiApiKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Giriş yapmanız gerekiyor.');
    }

    const db = admin.firestore();
    const callerDoc = await db.doc(`users/${request.auth.uid}`).get();
    if (callerDoc.data()?.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Bu işlem için yönetici yetkisi gerekiyor.');
    }

    const { categoryId, count = 5 } = request.data as GenerateQuestionsRequest;
    if (!categoryId) {
      throw new HttpsError('invalid-argument', 'categoryId zorunludur.');
    }
    const safeCount = Math.min(Math.max(count, 1), 20);

    const categorySnap = await db.doc(`categories/${categoryId}`).get();
    if (!categorySnap.exists) {
      throw new HttpsError('not-found', 'Kategori bulunamadı.');
    }
    const category = categorySnap.data() as { level: string; subject: string; topic: string };

    const prompt = buildPrompt(category.level, category.subject, category.topic, safeCount);
    const rawText = await callLLM(prompt);

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new HttpsError('internal', 'AI yanıtı geçerli JSON değil.');
    }

    const questions = validateGenerated(parsed);

    const batch = db.batch();
    const createdIds: string[] = [];
    for (const q of questions) {
      const ref = db.collection('questions').doc();
      const doc: QuestionDoc = {
        ...q,
        categoryId,
        level: category.level,
        subject: category.subject,
        source: 'ai-generated',
        aiModel: AI_MODEL_NAME,
        reviewStatus: 'draft',
        createdAt: Date.now(),
        usageCount: 0,
        correctCount: 0,
      };
      batch.set(ref, doc);
      createdIds.push(ref.id);
    }
    await batch.commit();

    return { createdCount: createdIds.length, questionIds: createdIds };
  }
);
