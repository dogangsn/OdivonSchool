"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateQuestions = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const aiProvider_1 = require("./aiProvider");
function buildPrompt(level, subject, topic, count) {
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
function validateGenerated(items) {
    if (!Array.isArray(items))
        throw new Error('AI response is not an array');
    return items.map((raw, i) => {
        const q = raw;
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
exports.generateQuestions = (0, https_1.onCall)({ secrets: [aiProvider_1.geminiApiKey] }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Giriş yapmanız gerekiyor.');
    }
    const db = admin.firestore();
    const callerDoc = await db.doc(`users/${request.auth.uid}`).get();
    if (callerDoc.data()?.role !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Bu işlem için yönetici yetkisi gerekiyor.');
    }
    const { categoryId, count = 5 } = request.data;
    if (!categoryId) {
        throw new https_1.HttpsError('invalid-argument', 'categoryId zorunludur.');
    }
    const safeCount = Math.min(Math.max(count, 1), 20);
    const categorySnap = await db.doc(`categories/${categoryId}`).get();
    if (!categorySnap.exists) {
        throw new https_1.HttpsError('not-found', 'Kategori bulunamadı.');
    }
    const category = categorySnap.data();
    const prompt = buildPrompt(category.level, category.subject, category.topic, safeCount);
    const rawText = await (0, aiProvider_1.callLLM)(prompt);
    let parsed;
    try {
        parsed = JSON.parse(rawText);
    }
    catch {
        throw new https_1.HttpsError('internal', 'AI yanıtı geçerli JSON değil.');
    }
    const questions = validateGenerated(parsed);
    const batch = db.batch();
    const createdIds = [];
    for (const q of questions) {
        const ref = db.collection('questions').doc();
        const doc = {
            ...q,
            categoryId,
            level: category.level,
            subject: category.subject,
            source: 'ai-generated',
            aiModel: aiProvider_1.AI_MODEL_NAME,
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
});
