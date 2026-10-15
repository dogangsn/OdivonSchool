import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  arrayUnion,
  collection,
  collectionData,
  deleteDoc,
  doc,
  docData,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { Observable, catchError, map, of } from 'rxjs';
import { AppUser } from '../../models/user';
import { Duel, DuelPlayer } from '../../models/duel';
import { LiveQuestion } from '../../models/live';

/** Waiting/running duels older than this are treated as abandoned. */
const OPEN_FOR_MS = 24 * 60 * 60 * 1000;

export interface NewDuel {
  title: string;
  subject: string;
  questions: LiveQuestion[];
  timeLimitSec: number;
  /** Teacher only: the students who may join. */
  invited?: string[];
}

/** Düellolar and teacher-set karşılaşmalar inside a class. */
@Injectable({ providedIn: 'root' })
export class DuelService {
  private firestore = inject(Firestore);

  private path(classId: string, duelId: string) {
    return `classes/${classId}/duels/${duelId}`;
  }

  duel(classId: string, duelId: string): Observable<Duel | undefined | null> {
    return (
      docData(doc(this.firestore, this.path(classId, duelId)), { idField: 'id' }) as Observable<Duel | undefined>
    ).pipe(catchError(() => of(null))); // null = not allowed to read
  }

  players(classId: string, duelId: string): Observable<DuelPlayer[]> {
    return (
      collectionData(collection(this.firestore, `${this.path(classId, duelId)}/players`)) as Observable<DuelPlayer[]>
    ).pipe(catchError(() => of([])));
  }

  /** Open duels in a class that concern this student (invited or joined). */
  openFor(classId: string, uid: string): Observable<Duel[]> {
    const col = collection(this.firestore, `classes/${classId}/duels`);
    const fresh = (list: Duel[]) =>
      list.filter((d) => d.status !== 'finished' && Date.now() - d.createdAt < OPEN_FOR_MS);
    return (
      collectionData(query(col, where('invited', 'array-contains', uid)), { idField: 'id' }) as Observable<Duel[]>
    ).pipe(
      map(fresh),
      catchError(() => of([]))
    );
  }

  /** Duels this student started or joined (for "Düellolarım"). */
  mine(classId: string, uid: string): Observable<Duel[]> {
    const col = collection(this.firestore, `classes/${classId}/duels`);
    return (
      collectionData(query(col, where('joined', 'array-contains', uid)), { idField: 'id' }) as Observable<Duel[]>
    ).pipe(
      map((list) => list.sort((a, b) => b.createdAt - a.createdAt)),
      catchError(() => of([]))
    );
  }

  /** The teacher's list of karşılaşmalar in a class. */
  byTeacher(classId: string, teacherId: string): Observable<Duel[]> {
    const col = collection(this.firestore, `classes/${classId}/duels`);
    return (
      collectionData(query(col, where('createdBy', '==', teacherId)), { idField: 'id' }) as Observable<Duel[]>
    ).pipe(
      map((list) => list.sort((a, b) => b.createdAt - a.createdAt)),
      catchError(() => of([]))
    );
  }

  /** A student's 2-player duel: they join it straight away. */
  async createStudentDuel(classId: string, user: AppUser, data: NewDuel): Promise<string> {
    const ref = doc(collection(this.firestore, `classes/${classId}/duels`));
    const duel: Omit<Duel, 'id'> = {
      ...this.base(classId, user, data),
      byTeacher: false,
      invited: [],
      joined: [user.uid],
      maxPlayers: 2,
    };
    const batch = writeBatch(this.firestore);
    batch.set(ref, duel);
    batch.set(doc(this.firestore, `${ref.path}/players/${user.uid}`), newPlayer(user));
    await batch.commit();
    return ref.id;
  }

  /** A teacher's karşılaşma for chosen students; the teacher hosts, not plays. */
  async createTeacherDuel(classId: string, teacher: AppUser, data: NewDuel): Promise<string> {
    const invited = [...new Set(data.invited ?? [])];
    const ref = doc(collection(this.firestore, `classes/${classId}/duels`));
    const duel: Omit<Duel, 'id'> = {
      ...this.base(classId, teacher, data),
      byTeacher: true,
      invited,
      joined: [],
      maxPlayers: invited.length,
    };
    const batch = writeBatch(this.firestore);
    batch.set(ref, duel);
    await batch.commit();
    return ref.id;
  }

  private base(classId: string, user: AppUser, data: NewDuel) {
    return {
      classId,
      createdBy: user.uid,
      creatorName: (user.displayName || 'Öğrenci').slice(0, 80),
      title: data.title.slice(0, 120),
      subject: data.subject.slice(0, 40),
      questions: data.questions,
      timeLimitSec: data.timeLimitSec,
      status: 'waiting' as const,
      startedAt: null,
      createdAt: Date.now(),
      endedAt: null,
    };
  }

  async join(classId: string, duelId: string, user: AppUser): Promise<void> {
    const batch = writeBatch(this.firestore);
    batch.update(doc(this.firestore, this.path(classId, duelId)), { joined: arrayUnion(user.uid) });
    batch.set(doc(this.firestore, `${this.path(classId, duelId)}/players/${user.uid}`), newPlayer(user));
    await batch.commit();
  }

  async start(classId: string, duelId: string): Promise<void> {
    await updateDoc(doc(this.firestore, this.path(classId, duelId)), {
      status: 'running',
      startedAt: serverTimestamp(),
    });
  }

  async finish(classId: string, duelId: string): Promise<void> {
    await updateDoc(doc(this.firestore, this.path(classId, duelId)), { status: 'finished', endedAt: Date.now() });
  }

  async remove(classId: string, duelId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, this.path(classId, duelId)));
  }

  async saveProgress(
    classId: string,
    duelId: string,
    uid: string,
    p: Pick<DuelPlayer, 'answered' | 'correct' | 'score' | 'durationMs' | 'done'>
  ): Promise<void> {
    await updateDoc(doc(this.firestore, `${this.path(classId, duelId)}/players/${uid}`), { ...p });
  }
}

function newPlayer(user: AppUser): DuelPlayer {
  return {
    uid: user.uid,
    name: (user.displayName || 'Öğrenci').slice(0, 80),
    joinedAt: Date.now(),
    answered: 0,
    correct: 0,
    score: 0,
    durationMs: 0,
    done: false,
  };
}
