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
  orderBy,
  limit,
  startAfter,
  documentId,
  getDocs,
  getCountFromServer,
  QueryConstraint,
} from '@angular/fire/firestore';
import { Observable, catchError, map } from 'rxjs';
import { Question } from '../../models/question';
import { TestCategory } from '../../models/test-category';
import { buildQuestionPrompt } from '../utils/question-prompt';

const API_KEY_STORAGE_KEY = 'odivon_gemini_api_key';
const GEMINI_MODEL = 'gemini-3.8-flash';

/** Position of the last question on a page; the next page starts after it. */
export interface DraftCursor {
  createdAt: number;
  id: string;
}

export interface DraftPage {
  items: Question[];
  hasNext: boolean;
}

/** Firestore batches accept at most 500 writes. */
const BATCH_CHUNK = 450;

export interface GeneratedQuestionItem {
  prompt: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  explanation: string;
  difficulty: number;
  outcomeCode?: string;
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

      return { ok: true, message: 'API Anahtarı başarıyla doğrulandı! Gemini 3.8 Flash hazır.' };
    } catch (e: any) {
      return { ok: false, message: `Bağlantı hatası: ${e.message}` };
    }
  }

  /**
   * Generates multiple-choice questions for a specific MEB/ÖSYM category using Gemini 3.8 Flash.
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
    const prompt = buildQuestionPrompt(category, safeCount, difficulty, subTopic);

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

    let cleanText = (rawText || '').trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(cleanText);
      if (!Array.isArray(parsed) && Array.isArray(parsed?.questions)) {
        parsed = parsed.questions;
      }
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
        ...(item.outcomeCode && category.outcomes?.some((o) => o.code === item.outcomeCode)
          ? { outcomeCode: item.outcomeCode }
          : {}),
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
      q.correctOptionId = (q.correctOptionId || '').toLowerCase().trim();
      q.options = q.options.map((opt) => ({
        id: (opt.id || '').toLowerCase().trim(),
        text: (opt.text || '').trim(),
      }));
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
    return (collectionData(this.draftQuery(), { idField: 'id' }) as Observable<Question[]>).pipe(
      map((list) => list.slice().sort(compareDrafts))
    );
  }

  /**
   * Real-time stream of one page of draft questions, newest first. Paging is
   * done in Firestore with a (createdAt, id) cursor; one extra document is
   * fetched to know whether a next page exists. Needs the
   * questions(reviewStatus, createdAt desc) composite index — until it is
   * deployed, falls back to paging the full draft list in the browser.
   */
  draftPage(cursor: DraftCursor | null, pageSize: number): Observable<DraftPage> {
    const constraints: QueryConstraint[] = [
      where('reviewStatus', '==', 'draft'),
      orderBy('createdAt', 'desc'),
      orderBy(documentId(), 'desc'),
    ];
    if (cursor) constraints.push(startAfter(cursor.createdAt, cursor.id));
    constraints.push(limit(pageSize + 1));

    const ref = collection(this.firestore, 'questions');
    return (collectionData(query(ref, ...constraints), { idField: 'id' }) as Observable<Question[]>).pipe(
      map((list) => ({ items: list.slice(0, pageSize), hasNext: list.length > pageSize })),
      catchError((err) => {
        console.warn(
          'Taslak sayfalama indeksi bulunamadı, istemci tarafı sayfalamaya geçiliyor. ' +
            '`firebase deploy --only firestore:indexes` çalıştırın.',
          err
        );
        return this.draftQuestions().pipe(
          map((list) => {
            const rest = cursor ? list.filter((q) => compareDrafts(q, cursorAsQuestion(cursor)) > 0) : list;
            return { items: rest.slice(0, pageSize), hasNext: rest.length > pageSize };
          })
        );
      })
    );
  }

  /** Total number of drafts, counted on the server. */
  async draftCount(): Promise<number> {
    const snap = await getCountFromServer(this.draftQuery());
    return snap.data().count;
  }

  /** Ids of every draft question, for "approve all". */
  async allDraftIds(): Promise<string[]> {
    const snap = await getDocs(this.draftQuery());
    return snap.docs.map((d) => d.id);
  }

  private draftQuery() {
    return query(collection(this.firestore, 'questions'), where('reviewStatus', '==', 'draft'));
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
   * Approves the given draft questions in bulk.
   */
  async bulkApprove(questionIds: string[]): Promise<void> {
    await this.inBatches(questionIds, (batch, id) =>
      batch.update(doc(this.firestore, `questions/${id}`), { reviewStatus: 'approved' })
    );
  }

  /**
   * Deletes the given draft questions in bulk.
   */
  async bulkReject(questionIds: string[]): Promise<void> {
    await this.inBatches(questionIds, (batch, id) => batch.delete(doc(this.firestore, `questions/${id}`)));
  }

  private async inBatches(
    ids: string[],
    op: (batch: ReturnType<typeof writeBatch>, id: string) => void
  ): Promise<void> {
    for (let i = 0; i < ids.length; i += BATCH_CHUNK) {
      const batch = writeBatch(this.firestore);
      for (const id of ids.slice(i, i + BATCH_CHUNK)) op(batch, id);
      await batch.commit();
    }
  }
}

/** Newest first, ties broken by id descending — same order as draftPage(). */
function compareDrafts(a: Pick<Question, 'createdAt' | 'id'>, b: Pick<Question, 'createdAt' | 'id'>): number {
  const byTime = (b.createdAt ?? 0) - (a.createdAt ?? 0);
  if (byTime !== 0) return byTime;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

function cursorAsQuestion(c: DraftCursor): Pick<Question, 'createdAt' | 'id'> {
  return { createdAt: c.createdAt, id: c.id };
}
