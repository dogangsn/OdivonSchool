import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  deleteDoc,
  doc,
  docData,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { Observable, catchError, firstValueFrom, map, of, take } from 'rxjs';
import { AuthService } from './auth';
import { AppUser } from '../../models/user';
import { Question } from '../../models/question';
import { Assignment } from '../../models/classroom';
import {
  ExamAnswerSheet,
  ExamKey,
  ExamQuestion,
  PoolState,
  TeacherQuestion,
  TeacherQuestionDraft,
  poolIdFor,
} from '../../models/teacher-question';
import { toPoolQuestion } from '../question-criteria';

/** An exam question together with its answer, as the teacher builds it. */
export interface ExamItem {
  question: ExamQuestion;
  correct: number;
  explanation: string;
  /** Stable key for the picker: `b:<bankId>` or `p:<poolId>`. */
  ref: string;
}

export interface NewExam {
  title: string;
  subject: string;
  dueAt: number | null;
  timeLimitMin: number;
  showAnswers: boolean;
  shuffle: boolean;
  items: ExamItem[];
}

/** Drops `undefined` fields, which Firestore refuses. */
function clean<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

export function bankItem(q: TeacherQuestion): ExamItem {
  return {
    ref: `b:${q.id}`,
    correct: q.correctIndex,
    explanation: q.explanation,
    question: {
      prompt: q.prompt,
      options: [...q.options],
      subject: q.subject,
      categoryId: q.categoryId,
      topic: q.topic,
      outcomeCode: q.outcomeCode,
      poolId: null,
    },
  };
}

export function poolItem(q: Question, topic: string | null): ExamItem {
  const options = [...q.options].sort((a, b) => a.id.localeCompare(b.id));
  return {
    ref: `p:${q.id}`,
    correct: Math.max(0, options.findIndex((o) => o.id === q.correctOptionId)),
    explanation: q.explanation ?? '',
    question: {
      prompt: q.prompt,
      options: options.map((o) => o.text),
      subject: q.subject ?? '',
      categoryId: q.categoryId,
      topic,
      outcomeCode: q.outcomeCode ?? null,
      poolId: q.id,
    },
  };
}

/** Öğretmen soru bankası, havuza öneri ve sınavlar. */
@Injectable({ providedIn: 'root' })
export class QuestionBankService {
  private firestore = inject(Firestore);
  private auth = inject(AuthService);

  private async me(): Promise<AppUser> {
    const user = await firstValueFrom(this.auth.appUser$.pipe(take(1)));
    if (!user) throw new Error('Oturum bulunamadı, lütfen tekrar giriş yapın.');
    return user;
  }

  // ------------------------------------------------------------------ bank
  myQuestions(ownerId: string): Observable<TeacherQuestion[]> {
    const q = query(collection(this.firestore, 'teacherQuestions'), where('ownerId', '==', ownerId));
    return (collectionData(q, { idField: 'id' }) as Observable<TeacherQuestion[]>).pipe(
      map((list) => [...list].sort((a, b) => b.updatedAt - a.updatedAt))
    );
  }

  async questionById(id: string): Promise<TeacherQuestion | null> {
    const snap = await getDoc(doc(this.firestore, `teacherQuestions/${id}`));
    return snap.exists() ? { ...(snap.data() as TeacherQuestion), id: snap.id } : null;
  }

  /** Creates or updates a bank question; returns the saved question. */
  async saveQuestion(draft: TeacherQuestionDraft, id?: string): Promise<TeacherQuestion> {
    const me = await this.me();
    const now = Date.now();
    const data = {
      ...draft,
      prompt: draft.prompt.trim(),
      options: draft.options.map((o) => o.trim()),
      explanation: draft.explanation.trim(),
    };
    if (id) {
      const prev = await this.questionById(id);
      const next: TeacherQuestion = {
        ...data,
        id,
        ownerId: me.uid,
        ownerName: (prev?.ownerName ?? me.displayName ?? 'Öğretmen').slice(0, 80),
        poolSubmittedAt: prev?.poolSubmittedAt ?? null,
        createdAt: prev?.createdAt ?? now,
        updatedAt: now,
      };
      const { id: _id, ...rest } = next;
      await setDoc(doc(this.firestore, `teacherQuestions/${id}`), rest);
      return next;
    }
    const ref = doc(collection(this.firestore, 'teacherQuestions'));
    const created: TeacherQuestion = {
      ...data,
      id: ref.id,
      ownerId: me.uid,
      ownerName: (me.displayName || 'Öğretmen').slice(0, 80),
      poolSubmittedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const { id: _id, ...rest } = created;
    await setDoc(ref, rest);
    return created;
  }

  async deleteQuestion(q: TeacherQuestion, state: PoolState): Promise<void> {
    // A copy still waiting for review goes too; an approved one stays in the pool.
    if (state === 'pending') await this.withdrawFromPool(q).catch(() => undefined);
    await deleteDoc(doc(this.firestore, `teacherQuestions/${q.id}`));
  }

  // ------------------------------------------------------------------ pool
  /** Approved pool questions of a konu (for exams and the duplicate check). */
  async approvedForCategory(categoryId: string): Promise<Question[]> {
    const q = query(
      collection(this.firestore, 'questions'),
      where('categoryId', '==', categoryId),
      where('reviewStatus', '==', 'approved')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as Question), id: d.id }));
  }

  /** The teacher's own pool copies (draft or approved), live. */
  myPoolCopies(uid: string): Observable<Question[]> {
    const q = query(collection(this.firestore, 'questions'), where('authorId', '==', uid));
    return (collectionData(q, { idField: 'id' }) as Observable<Question[]>).pipe(
      catchError((err) => {
        console.warn('[QuestionBank] pool copies not readable:', err);
        return of([]);
      })
    );
  }

  /** Offers the question to the shared pool as a draft for admin review. */
  async submitToPool(q: TeacherQuestion): Promise<void> {
    const now = Date.now();
    await setDoc(doc(this.firestore, `questions/${poolIdFor(q.id)}`), toPoolQuestion(q, now));
    await updateDoc(doc(this.firestore, `teacherQuestions/${q.id}`), { poolSubmittedAt: now });
  }

  /** Takes back a copy that is still waiting for review. */
  async withdrawFromPool(q: TeacherQuestion): Promise<void> {
    await deleteDoc(doc(this.firestore, `questions/${poolIdFor(q.id)}`));
    await updateDoc(doc(this.firestore, `teacherQuestions/${q.id}`), { poolSubmittedAt: null });
  }

  // ----------------------------------------------------------------- exams
  /** Gives the same exam to each class: assignment + its hidden answer key. */
  async createExam(classIds: string[], exam: NewExam): Promise<void> {
    const me = await this.me();
    const now = Date.now();
    for (const classId of classIds) {
      const batch = writeBatch(this.firestore);
      const ref = doc(collection(this.firestore, `classes/${classId}/assignments`));
      const assignment: Omit<Assignment, 'id'> = clean({
        classId,
        teacherId: me.uid,
        kind: 'exam' as const,
        title: exam.title.slice(0, 120),
        subject: exam.subject.slice(0, 60),
        dueAt: exam.dueAt,
        createdAt: now,
        examQuestions: exam.items.map((i) => i.question),
        questionCount: exam.items.length,
        timeLimitMin: exam.timeLimitMin,
        showAnswers: exam.showAnswers,
        shuffle: exam.shuffle,
      });
      const key: ExamKey = {
        correct: exam.items.map((i) => i.correct),
        explanations: exam.items.map((i) => i.explanation.slice(0, 1000)),
      };
      batch.set(ref, assignment);
      batch.set(doc(this.firestore, `classes/${classId}/assignments/${ref.id}/examKey/key`), key);
      await batch.commit();
    }
  }

  /** Readable by the teacher, and by a student once they handed in. */
  async examKey(classId: string, assignmentId: string): Promise<ExamKey | null> {
    const snap = await getDoc(doc(this.firestore, `classes/${classId}/assignments/${assignmentId}/examKey/key`));
    return snap.exists() ? (snap.data() as ExamKey) : null;
  }

  async myAnswerSheet(classId: string, assignmentId: string, uid: string): Promise<ExamAnswerSheet | null> {
    const snap = await getDoc(
      doc(this.firestore, `classes/${classId}/assignments/${assignmentId}/examAnswers/${uid}`)
    ).catch(() => null);
    return snap?.exists() ? (snap.data() as ExamAnswerSheet) : null;
  }

  async handIn(classId: string, assignmentId: string, sheet: ExamAnswerSheet): Promise<void> {
    await setDoc(doc(this.firestore, `classes/${classId}/assignments/${assignmentId}/examAnswers/${sheet.uid}`), sheet);
  }

  answerSheets(classId: string, assignmentId: string): Observable<ExamAnswerSheet[]> {
    return collectionData(
      collection(this.firestore, `classes/${classId}/assignments/${assignmentId}/examAnswers`)
    ) as Observable<ExamAnswerSheet[]>;
  }

  assignmentById(classId: string, assignmentId: string): Observable<Assignment | undefined> {
    return docData(doc(this.firestore, `classes/${classId}/assignments/${assignmentId}`), {
      idField: 'id',
    }) as Observable<Assignment | undefined>;
  }
}
