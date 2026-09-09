import { Injectable, inject, signal } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
} from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';
import { Question } from '../../models/question';
import { TestCategory } from '../../models/test-category';

const API_KEY_STORAGE_KEY = 'odivon_gemini_api_key';
const GEMINI_MODEL = 'gemini-2.0-flash';

export interface GeneratedQuestionItem {
  prompt: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  explanation: string;
  difficulty: number;
}

@Injectable({ providedIn: 'root' })
export class AiGeneratorService {
  private firestore = inject(Firestore);

  apiKey = signal<string>(this.loadStoredApiKey());

  private loadStoredApiKey(): string {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
  }

  setApiKey(key: string) {
    const trimmed = key.trim();
    this.apiKey.set(trimmed);
    if (trimmed) {
      localStorage.setItem(API_KEY_STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  }

  hasApiKey(): boolean {
    return !!this.apiKey();
  }

  /**
   * Tests whether the provided or stored Gemini API key is valid.
   */
  async testApiKey(customKey?: string): Promise<{ ok: boolean; message: string }> {
    const key = (customKey ?? this.apiKey()).trim();
    if (!key) {
      return { ok: false, message: 'Lütfen bir Gemini API anahtarı girin.' };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Ping. Sadece "OK" yanıtı ver.' }] }],
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errMsg = errorData?.error?.message || `HTTP ${res.status}`;
        return { ok: false, message: `Geçersiz API Anahtarı: ${errMsg}` };
      }

      return { ok: true, message: 'API Anahtarı başarıyla doğrulandı! Gemini 2.0 Flash hazır.' };
    } catch (e: any) {
      return { ok: false, message: `Bağlantı hatası: ${e.message}` };
    }
  }

  /**
   * Generates multiple-choice questions for a specific MEB/ÖSYM category using Gemini 2.0 Flash.
   * Saves the results to Firestore as draft questions.
   */
  async generateQuestions(
    category: TestCategory,
    count: number = 5,
    difficulty: number = 2,
    subTopic?: string
  ): Promise<Question[]> {
    const key = this.apiKey();
    if (!key) {
      throw new Error('Gemini API anahtarı bulunamadı. Lütfen önce API anahtarınızı girin.');
    }

    const safeCount = Math.min(Math.max(count, 1), 15);
    const prompt = this.buildPrompt(category, safeCount, difficulty, subTopic);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API Hatası (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error('Gemini API boş yanıt döndürdü.');
    }

    let parsed: GeneratedQuestionItem[];
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Error('Yapay zeka yanıtı geçerli JSON formatında değil.');
    }

    const validatedItems = this.validateQuestions(parsed);

    // Save to Firestore as draft questions
    const createdQuestions: Question[] = [];
    for (const item of validatedItems) {
      const validDifficulty = (Math.min(Math.max(item.difficulty || difficulty || 2, 1), 5) as 1 | 2 | 3 | 4 | 5);
      const qDoc: Omit<Question, 'id'> = {
        categoryId: category.id,
        level: category.level,
        subject: category.subject,
        prompt: item.prompt,
        options: item.options,
        correctOptionId: item.correctOptionId,
        explanation: item.explanation,
        difficulty: validDifficulty,
        source: 'ai-generated',
        aiModel: GEMINI_MODEL,
        reviewStatus: 'draft',
        createdAt: Date.now(),
        usageCount: 0,
        correctCount: 0,
      };

      const docRef = await addDoc(collection(this.firestore, 'questions'), qDoc);
      createdQuestions.push({
        id: docRef.id,
        ...qDoc,
      });
    }

    return createdQuestions;
  }

  private buildPrompt(
    category: TestCategory,
    count: number,
    difficulty: number,
    subTopic?: string
  ): string {
    const difficultyGuide =
      difficulty === 1
        ? 'Çok Kolay / Temel Kavram'
        : difficulty === 2
        ? 'Kolay / Anlama ve Uygulama'
        : difficulty === 3
        ? 'Orta / Standart Sınav Seviyesi'
        : difficulty === 4
        ? 'Zor / Muhakeme ve Analiz'
        : difficulty === 5
        ? 'İleri Düzey / Eleme Sorusu'
        : 'Karışık Zorluk Derecesi (1 ile 5 arası dengeli)';

    return `
Sen Türkiye Cumhuriyeti MEB ve ÖSYM sınav standartlarına tam hakim, uzman bir soru yazarısın.
Eğitim Kademesi: "${category.level.toUpperCase()}"
Ders: "${category.subject}"
Ana Konu: "${category.topic}"
${subTopic ? `Özel Odak / Alt Başlık: "${subTopic}"` : ''}
Hedef Zorluk Düzeyi: ${difficultyGuide} (1-5 arası)
Soru Sayısı: ${count} adet

GÖREV:
Bu konuya ait, güncel müfredat kazanımlarına %100 uygun, yüksek kaliteli, çoktan seçmeli ${count} adet soru hazırla.

KESİN KURALLAR:
1. Her soruda TAM OLARAK 4 seçenek olmalı: "a", "b", "c", "d".
2. "correctOptionId" mutlak surette "a", "b", "c" veya "d" değerlerinden biri olmalı.
3. Çeldiriciler (yanlış şıklar) öğrencinin yapabileceği tipik işlem hatalarına veya kavram yanılgılarına uygun, gerçekçi olmalı.
4. "explanation" (Çözüm Açıklaması) çok önemlidir: Öğrenci soruyu yanlış yaptığında konuyu eksiksiz öğrenebilsin. Doğru cevaba nasıl ulaşıldığını, formülü, kuralı veya mantığı adım adım, samimi ve anlaşılır bir dille anlat.
5. Sadece ve sadece aşağıdaki JSON şemasına uyan JSON dizisi (array) döndür. Önüne veya arkasına hiçbir markdown açıklaması ekleme.

JSON ŞEMASI:
[
  {
    "prompt": "Soru metni buraya",
    "options": [
      { "id": "a", "text": "A seçeneği" },
      { "id": "b", "text": "B seçeneği" },
      { "id": "c", "text": "C seçeneği" },
      { "id": "d", "text": "D seçeneği" }
    ],
    "correctOptionId": "a",
    "explanation": "Detaylı ve öğretici çözüm açıklaması",
    "difficulty": ${difficulty > 0 ? difficulty : 3}
  }
]
`.trim();
  }

  private validateQuestions(items: unknown): GeneratedQuestionItem[] {
    if (!Array.isArray(items)) {
      throw new Error('AI yanıtı bir dizi değil.');
    }

    return items.map((raw, i) => {
      const q = raw as GeneratedQuestionItem;
      if (!q.prompt || typeof q.prompt !== 'string') {
        throw new Error(`${i + 1}. sorunun soru metni (prompt) eksik.`);
      }
      if (!Array.isArray(q.options) || q.options.length !== 4) {
        throw new Error(`${i + 1}. soruda tam 4 seçenek bulunmalıdır.`);
      }
      if (!q.options.some((o) => o.id === q.correctOptionId)) {
        throw new Error(`${i + 1}. sorunun doğru seçeneği (${q.correctOptionId}) şıklar arasında yok.`);
      }
      if (!q.explanation || typeof q.explanation !== 'string') {
        throw new Error(`${i + 1}. sorunun çözüm açıklaması eksik.`);
      }
      return q;
    });
  }

  /**
   * Real-time stream of draft questions awaiting review.
   */
  draftQuestions(): Observable<Question[]> {
    const ref = collection(this.firestore, 'questions');
    const q = query(ref, where('reviewStatus', '==', 'draft'));
    return (collectionData(q, { idField: 'id' }) as Observable<Question[]>).pipe(
      map((list) => list.slice().sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)))
    );
  }

  /**
   * Approves a question to make it instantly visible and playable by students.
   */
  async approveQuestion(questionId: string): Promise<void> {
    const ref = doc(this.firestore, `questions/${questionId}`);
    await updateDoc(ref, { reviewStatus: 'approved' });
  }

  /**
   * Rejects / deletes an unsatisfactory question from the pool.
   */
  async rejectQuestion(questionId: string): Promise<void> {
    const ref = doc(this.firestore, `questions/${questionId}`);
    await deleteDoc(ref);
  }

  /**
   * Updates an existing draft question before approving it.
   */
  async updateQuestion(questionId: string, updates: Partial<Question>): Promise<void> {
    const ref = doc(this.firestore, `questions/${questionId}`);
    await updateDoc(ref, updates);
  }

  /**
   * Approves all draft questions in bulk.
   */
  async bulkApprove(questionIds: string[]): Promise<void> {
    const batch = writeBatch(this.firestore);
    for (const id of questionIds) {
      const ref = doc(this.firestore, `questions/${id}`);
      batch.update(ref, { reviewStatus: 'approved' });
    }
    await batch.commit();
  }
}
