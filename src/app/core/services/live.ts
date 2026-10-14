import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { Observable, catchError, map, of } from 'rxjs';
import { AppUser } from '../../models/user';
import {
  LeaderEntry,
  LiveAnswer,
  LivePlayer,
  LivePrivate,
  LiveQuestion,
  LiveSession,
} from '../../models/live';
import { ScoredAnswer, toMillis } from '../live-scoring';

/** Sessions older than this are treated as abandoned and hidden from students. */
const ACTIVE_FOR_MS = 3 * 60 * 60 * 1000;

export interface NewLiveSession {
  title: string;
  subject: string;
  categoryId: string | null;
  durationSec: number;
  questions: LiveQuestion[];
}

/** Live class competitions: the teacher hosts, class members play. */
@Injectable({ providedIn: 'root' })
export class LiveService {
  private firestore = inject(Firestore);

  private base(classId: string, sessionId: string) {
    return `classes/${classId}/live/${sessionId}`;
  }

  // ------------------------------------------------------------- shared
  session(classId: string, sessionId: string): Observable<LiveSession | undefined> {
    return (
      docData(doc(this.firestore, this.base(classId, sessionId)), { idField: 'id' }) as Observable<
        LiveSession | undefined
      >
    ).pipe(catchError(() => of(undefined)));
  }

  /** Sessions a student can still join in one class. */
  activeSessions(classId: string): Observable<LiveSession[]> {
    const q = query(
      collection(this.firestore, `classes/${classId}/live`),
      where('status', 'in', ['lobby', 'question', 'reveal'])
    );
    return (collectionData(q, { idField: 'id' }) as Observable<LiveSession[]>).pipe(
      map((list) => list.filter((s) => Date.now() - s.createdAt < ACTIVE_FOR_MS)),
      catchError(() => of([]))
    );
  }

  // ------------------------------------------------------------- teacher
  async create(classId: string, teacherId: string, data: NewLiveSession): Promise<string> {
    const ref = doc(collection(this.firestore, `classes/${classId}/live`));
    const session: Omit<LiveSession, 'id'> = {
      classId,
      teacherId,
      title: data.title,
      subject: data.subject,
      categoryId: data.categoryId,
      status: 'lobby',
      questionIndex: -1,
      questionCount: data.questions.length,
      durationSec: data.durationSec,
      question: null,
      reveal: null,
      leaderboard: [],
      players: 0,
      createdAt: Date.now(),
      endedAt: null,
    };
    const batch = writeBatch(this.firestore);
    batch.set(ref, session);
    batch.set(doc(this.firestore, `${ref.path}/private/questions`), {
      questions: data.questions,
    } satisfies LivePrivate);
    await batch.commit();
    return ref.id;
  }

  async questions(classId: string, sessionId: string): Promise<LiveQuestion[]> {
    const snap = await getDoc(doc(this.firestore, `${this.base(classId, sessionId)}/private/questions`));
    return snap.exists() ? (snap.data() as LivePrivate).questions : [];
  }

  players(classId: string, sessionId: string): Observable<LivePlayer[]> {
    return (
      collectionData(collection(this.firestore, `${this.base(classId, sessionId)}/players`)) as Observable<
        LivePlayer[]
      >
    ).pipe(catchError(() => of([])));
  }

  /** Opens question `index`; students see it without the answer. */
  async openQuestion(classId: string, sessionId: string, index: number, q: LiveQuestion, durationSec: number, players: number) {
    await updateDoc(doc(this.firestore, this.base(classId, sessionId)), {
      status: 'question',
      questionIndex: index,
      question: { prompt: q.prompt, options: q.options, startedAt: serverTimestamp(), durationSec },
      reveal: null,
      players,
    });
  }

  /** Server start time of the open question, once the write has landed. */
  async questionStartedAt(classId: string, sessionId: string): Promise<number | null> {
    const snap = await getDoc(doc(this.firestore, this.base(classId, sessionId)));
    return toMillis((snap.data() as LiveSession | undefined)?.question?.startedAt);
  }

  async answers(classId: string, sessionId: string, q: number): Promise<ScoredAnswer[]> {
    const snap = await getDocs(
      query(collection(this.firestore, `${this.base(classId, sessionId)}/answers`), where('q', '==', q))
    );
    return snap.docs
      .map((d) => d.data() as LiveAnswer)
      .map((a) => ({ uid: a.uid, choice: a.choice, answeredAtMs: toMillis(a.answeredAt) ?? Infinity }));
  }

  answerCount(classId: string, sessionId: string, q: number): Observable<number> {
    return collectionData(
      query(collection(this.firestore, `${this.base(classId, sessionId)}/answers`), where('q', '==', q))
    ).pipe(
      map((list) => list.length),
      catchError(() => of(0))
    );
  }

  /** Shows the right answer and writes everyone's new score in one batch. */
  async reveal(
    classId: string,
    sessionId: string,
    reveal: { correctIndex: number; counts: number[]; explanation: string },
    leaderboard: LeaderEntry[],
    players: LivePlayer[]
  ) {
    const batch = writeBatch(this.firestore);
    batch.update(doc(this.firestore, this.base(classId, sessionId)), { status: 'reveal', reveal, leaderboard });
    for (const p of players) {
      batch.update(doc(this.firestore, `${this.base(classId, sessionId)}/players/${p.uid}`), {
        score: p.score,
        correct: p.correct,
        lastGained: p.lastGained,
        lastCorrect: p.lastCorrect,
        rank: p.rank,
      });
    }
    await batch.commit();
  }

  async finish(classId: string, sessionId: string, leaderboard?: LeaderEntry[]) {
    await updateDoc(doc(this.firestore, this.base(classId, sessionId)), {
      status: 'finished',
      endedAt: Date.now(),
      question: null,
      ...(leaderboard ? { leaderboard } : {}),
    });
  }

  // ------------------------------------------------------------- student
  async join(classId: string, sessionId: string, user: AppUser): Promise<void> {
    const ref = doc(this.firestore, `${this.base(classId, sessionId)}/players/${user.uid}`);
    const snap = await getDoc(ref);
    if (snap.exists()) return;
    const player: LivePlayer = {
      uid: user.uid,
      displayName: (user.displayName || 'Öğrenci').slice(0, 80),
      joinedAt: Date.now(),
      score: 0,
      correct: 0,
      lastGained: 0,
      lastCorrect: null,
      rank: 0,
    };
    await setDoc(ref, player);
  }

  me(classId: string, sessionId: string, uid: string): Observable<LivePlayer | null> {
    return (
      docData(doc(this.firestore, `${this.base(classId, sessionId)}/players/${uid}`)) as Observable<
        LivePlayer | undefined
      >
    ).pipe(
      map((p) => p ?? null),
      catchError(() => of(null))
    );
  }

  async answer(classId: string, sessionId: string, q: number, choice: number, uid: string): Promise<void> {
    await setDoc(doc(this.firestore, `${this.base(classId, sessionId)}/answers/${q}_${uid}`), {
      uid,
      q,
      choice,
      answeredAt: serverTimestamp(),
    });
  }
}
