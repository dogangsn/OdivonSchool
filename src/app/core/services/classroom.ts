import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  arrayRemove,
  arrayUnion,
  collection,
  collectionData,
  deleteDoc,
  doc,
  docData,
  getCountFromServer,
  getDoc,
  increment,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { Observable, catchError, combineLatest, firstValueFrom, map, of, switchMap, take } from 'rxjs';
import { AuthService } from './auth';
import { AppUser } from '../../models/user';
import {
  Assignment,
  AssignmentRef,
  ClassMember,
  ClassProgress,
  Classroom,
  ProgressEntry,
  Submission,
  TeacherContent,
} from '../../models/classroom';
import { GameOutcome } from '../../games/game-models';
import { LeagueEntry } from '../../models/live';
import { isoWeekKey } from '../live-scoring';

/** No 0/O, 1/I/L: codes are read aloud in class and typed by children. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const MAX_CODE_TRIES = 5;

export function generateJoinCode(rng: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)];
  return code;
}

export function normalizeJoinCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** An assignment together with the student's own submission (if any). */
export interface StudentAssignment {
  classroom: Classroom;
  assignment: Assignment;
  submission: Submission | null;
}

/** Strips `undefined` fields, which Firestore refuses to store. */
function clean<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

/**
 * Classes, join codes, assignments and submissions for both sides:
 * teachers manage their classes, students join with a code and do assignments.
 */
@Injectable({ providedIn: 'root' })
export class ClassroomService {
  private firestore = inject(Firestore);
  private auth = inject(AuthService);

  private async me(): Promise<AppUser> {
    const user = await firstValueFrom(this.auth.appUser$.pipe(take(1)));
    if (!user) throw new Error('Oturum bulunamadı, lütfen tekrar giriş yapın.');
    return user;
  }

  // ---------------------------------------------------------------- teacher
  myClasses(teacherId: string): Observable<Classroom[]> {
    const q = query(
      collection(this.firestore, 'classes'),
      where('teacherId', '==', teacherId),
      orderBy('createdAt', 'desc')
    );
    return collectionData(q, { idField: 'id' }) as Observable<Classroom[]>;
  }

  classById(classId: string): Observable<Classroom | undefined> {
    return docData(doc(this.firestore, `classes/${classId}`), { idField: 'id' }) as Observable<
      Classroom | undefined
    >;
  }

  async createClass(name: string, grade: number): Promise<string> {
    const me = await this.me();
    const classRef = doc(collection(this.firestore, 'classes'));
    for (let attempt = 0; attempt < MAX_CODE_TRIES; attempt++) {
      const joinCode = generateJoinCode();
      const batch = writeBatch(this.firestore);
      const classroom: Omit<Classroom, 'id'> = {
        teacherId: me.uid,
        teacherName: me.displayName,
        name: name.trim(),
        grade,
        joinCode,
        createdAt: Date.now(),
      };
      batch.set(classRef, classroom);
      batch.set(doc(this.firestore, `classCodes/${joinCode}`), { classId: classRef.id, teacherId: me.uid });
      try {
        await batch.commit();
        return classRef.id;
      } catch (err: any) {
        // A taken code makes the classCodes write an update, which the rules reject.
        if (err?.code !== 'permission-denied' || attempt === MAX_CODE_TRIES - 1) throw err;
      }
    }
    throw new Error('Sınıf kodu oluşturulamadı.');
  }

  async renameClass(c: Classroom, name: string, grade: number): Promise<void> {
    await updateDoc(doc(this.firestore, `classes/${c.id}`), { name: name.trim(), grade });
  }

  /** New join code; the old one stops working (existing members stay). */
  async regenerateCode(c: Classroom): Promise<string> {
    for (let attempt = 0; attempt < MAX_CODE_TRIES; attempt++) {
      const joinCode = generateJoinCode();
      const batch = writeBatch(this.firestore);
      batch.update(doc(this.firestore, `classes/${c.id}`), { joinCode });
      batch.delete(doc(this.firestore, `classCodes/${c.joinCode}`));
      batch.set(doc(this.firestore, `classCodes/${joinCode}`), { classId: c.id, teacherId: c.teacherId });
      try {
        await batch.commit();
        return joinCode;
      } catch (err: any) {
        if (err?.code !== 'permission-denied' || attempt === MAX_CODE_TRIES - 1) throw err;
      }
    }
    throw new Error('Yeni kod oluşturulamadı.');
  }

  async archiveClass(c: Classroom, archived: boolean): Promise<void> {
    await updateDoc(doc(this.firestore, `classes/${c.id}`), { archived });
  }

  members(classId: string): Observable<ClassMember[]> {
    const q = query(collection(this.firestore, `classes/${classId}/members`), orderBy('displayName'));
    return collectionData(q) as Observable<ClassMember[]>;
  }

  async removeMember(classId: string, uid: string): Promise<void> {
    await deleteDoc(doc(this.firestore, `classes/${classId}/members/${uid}`));
  }

  assignments(classId: string): Observable<Assignment[]> {
    const q = query(
      collection(this.firestore, `classes/${classId}/assignments`),
      orderBy('createdAt', 'desc')
    );
    return collectionData(q, { idField: 'id' }) as Observable<Assignment[]>;
  }

  async createAssignment(classId: string, data: Omit<Assignment, 'id' | 'classId' | 'teacherId' | 'createdAt'>) {
    const me = await this.me();
    const ref = doc(collection(this.firestore, `classes/${classId}/assignments`));
    const assignment: Omit<Assignment, 'id'> = clean({
      ...data,
      classId,
      teacherId: me.uid,
      createdAt: Date.now(),
    });
    await setDoc(ref, assignment);
    return ref.id;
  }

  async deleteAssignment(classId: string, assignmentId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, `classes/${classId}/assignments/${assignmentId}`));
  }

  submissions(classId: string, assignmentId: string): Observable<Submission[]> {
    return collectionData(
      collection(this.firestore, `classes/${classId}/assignments/${assignmentId}/submissions`)
    ) as Observable<Submission[]>;
  }

  async submissionCount(classId: string, assignmentId: string): Promise<number> {
    const snap = await getCountFromServer(
      collection(this.firestore, `classes/${classId}/assignments/${assignmentId}/submissions`)
    );
    return snap.data().count;
  }

  // ---------------------------------------------------------------- content
  myContent(ownerId: string): Observable<TeacherContent[]> {
    const q = query(
      collection(this.firestore, 'teacherContent'),
      where('ownerId', '==', ownerId),
      orderBy('updatedAt', 'desc')
    );
    return collectionData(q, { idField: 'id' }) as Observable<TeacherContent[]>;
  }

  async contentById(id: string): Promise<TeacherContent | null> {
    const snap = await getDoc(doc(this.firestore, `teacherContent/${id}`));
    return snap.exists() ? ({ ...(snap.data() as TeacherContent), id: snap.id }) : null;
  }

  async saveContent(content: Omit<TeacherContent, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>, id?: string) {
    const me = await this.me();
    const now = Date.now();
    if (id) {
      await updateDoc(doc(this.firestore, `teacherContent/${id}`), clean({ ...content, updatedAt: now }));
      return id;
    }
    const ref = doc(collection(this.firestore, 'teacherContent'));
    await setDoc(ref, clean({ ...content, ownerId: me.uid, createdAt: now, updatedAt: now }));
    return ref.id;
  }

  async deleteContent(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, `teacherContent/${id}`));
  }

  // ---------------------------------------------------------------- student
  /** Joins the class behind `code`; returns the class name. */
  async joinWithCode(rawCode: string): Promise<string> {
    const me = await this.me();
    const code = normalizeJoinCode(rawCode);
    if (code.length !== 6) throw new Error('Sınıf kodu 6 karakter olmalı.');

    const codeSnap = await getDoc(doc(this.firestore, `classCodes/${code}`));
    if (!codeSnap.exists()) throw new Error('Bu kodla bir sınıf bulunamadı. Kodu öğretmenine sorabilirsin.');
    const classId = (codeSnap.data() as { classId: string }).classId;

    const member: ClassMember = {
      uid: me.uid,
      displayName: me.displayName,
      grade: me.grade ?? null,
      joinCode: code,
      joinedAt: Date.now(),
    };
    const memberRef = doc(this.firestore, `classes/${classId}/members/${me.uid}`);
    // Members can't be updated, so only create when not already in the class.
    const existing = await getDoc(memberRef).catch(() => null);
    if (!existing?.exists()) await setDoc(memberRef, member);
    await updateDoc(doc(this.firestore, `users/${me.uid}`), { classIds: arrayUnion(classId) });

    const classSnap = await getDoc(doc(this.firestore, `classes/${classId}`));
    return classSnap.exists() ? (classSnap.data() as Classroom).name : 'Sınıf';
  }

  async leaveClass(classId: string): Promise<void> {
    const me = await this.me();
    await deleteDoc(doc(this.firestore, `classes/${classId}/members/${me.uid}`)).catch(() => undefined);
    await updateDoc(doc(this.firestore, `users/${me.uid}`), { classIds: arrayRemove(classId) });
  }

  /** The student's classes (ones they were removed from are skipped). */
  studentClasses(user: AppUser): Observable<Classroom[]> {
    const ids = user.classIds ?? [];
    if (ids.length === 0) return of([]);
    return combineLatest(
      ids.map((id) => this.classById(id).pipe(catchError(() => of(undefined))))
    ).pipe(map((list) => list.filter((c): c is Classroom => !!c && !c.archived)));
  }

  /** Every assignment across the student's classes, with their own submission. */
  studentAssignments(user: AppUser): Observable<StudentAssignment[]> {
    return this.studentClasses(user).pipe(
      switchMap((classes) => {
        if (classes.length === 0) return of([]);
        return combineLatest(
          classes.map((c) =>
            this.assignments(c.id).pipe(
              catchError(() => of([] as Assignment[])),
              switchMap((list) =>
                list.length === 0
                  ? of([] as StudentAssignment[])
                  : combineLatest(
                      list.map((a) =>
                        this.mySubmission({ classId: c.id, assignmentId: a.id }, user.uid).pipe(
                          map((submission) => ({ classroom: c, assignment: a, submission }))
                        )
                      )
                    )
              )
            )
          )
        ).pipe(
          map((groups) =>
            groups.flat().sort((x, y) => {
              // Undone first (soonest due first), then done (newest first).
              const xd = x.submission ? 1 : 0;
              const yd = y.submission ? 1 : 0;
              if (xd !== yd) return xd - yd;
              const xdue = x.assignment.dueAt ?? Infinity;
              const ydue = y.assignment.dueAt ?? Infinity;
              if (xdue !== ydue) return xdue - ydue;
              return y.assignment.createdAt - x.assignment.createdAt;
            })
          )
        );
      })
    );
  }

  assignment(ref: AssignmentRef): Observable<Assignment | undefined> {
    return docData(doc(this.firestore, `classes/${ref.classId}/assignments/${ref.assignmentId}`), {
      idField: 'id',
    }) as Observable<Assignment | undefined>;
  }

  mySubmission(ref: AssignmentRef, uid: string): Observable<Submission | null> {
    return (
      docData(
        doc(this.firestore, `classes/${ref.classId}/assignments/${ref.assignmentId}/submissions/${uid}`)
      ) as Observable<Submission | undefined>
    ).pipe(
      map((s) => s ?? null),
      catchError(() => of(null))
    );
  }

  /** Records a finished assignment game, keeping the best score. */
  async submit(ref: AssignmentRef, outcome: GameOutcome): Promise<void> {
    const me = await this.me();
    const path = `classes/${ref.classId}/assignments/${ref.assignmentId}/submissions/${me.uid}`;
    const prevSnap = await getDoc(doc(this.firestore, path));
    const prev = prevSnap.exists() ? (prevSnap.data() as Submission) : null;
    const now = Date.now();
    const submission: Submission = {
      uid: me.uid,
      displayName: me.displayName,
      score: outcome.score,
      stars: outcome.stars,
      correct: outcome.correct,
      total: outcome.total,
      durationMs: Math.round(outcome.durationMs),
      bestScore: Math.max(prev?.bestScore ?? 0, outcome.score),
      bestStars: Math.max(prev?.bestStars ?? 0, outcome.stars),
      attempts: (prev?.attempts ?? 0) + 1,
      mistakes: outcome.mistakes.slice(0, 20),
      firstCompletedAt: prev?.firstCompletedAt ?? now,
      completedAt: now,
    };
    await setDoc(doc(this.firestore, path), submission);
  }

  /** Every student's running totals in a class (teacher's tracking tab). */
  classProgress(classId: string): Observable<ClassProgress[]> {
    return collectionData(collection(this.firestore, `classes/${classId}/progress`)) as Observable<
      ClassProgress[]
    >;
  }

  /** Submissions of every assignment, keyed by assignment id. */
  allSubmissions(classId: string, assignments: Assignment[]): Observable<Record<string, Submission[]>> {
    if (assignments.length === 0) return of({});
    return combineLatest(
      assignments.map((a) =>
        this.submissions(classId, a.id).pipe(
          catchError(() => of([] as Submission[])),
          map((list) => [a.id, list] as const)
        )
      )
    ).pipe(map((pairs) => Object.fromEntries(pairs)));
  }

  /**
   * Adds a finished game or test to the student's progress in each of their
   * classes. Failures are logged only: tracking must never block the result.
   */
  async recordProgress(user: AppUser, entry: ProgressEntry, streakDays: number): Promise<void> {
    const classIds = user.classIds ?? [];
    if (classIds.length === 0 || !(entry.total > 0)) return;
    const now = Date.now();
    const data = {
      uid: user.uid,
      displayName: user.displayName,
      lastActiveAt: now,
      streakDays,
      activities: increment(1),
      answered: increment(entry.total),
      correct: increment(entry.correct),
      topics: {
        [entry.key]: {
          label: entry.label.slice(0, 120),
          subject: entry.subject.slice(0, 60),
          correct: increment(entry.correct),
          total: increment(entry.total),
          lastAt: now,
        },
      },
    };
    await Promise.all(
      classIds.map((classId) =>
        setDoc(doc(this.firestore, `classes/${classId}/progress/${user.uid}`), data, { merge: true }).catch(
          (err) => console.warn(`[Classroom] progress for ${classId} not saved:`, err)
        )
      )
    );
  }

  /** Adds XP to this week's league in each of the student's classes. */
  async recordLeague(user: AppUser, xpGained: number): Promise<void> {
    const classIds = user.classIds ?? [];
    if (classIds.length === 0 || xpGained <= 0) return;
    const week = isoWeekKey(Date.now());
    const gain = Math.min(600, Math.round(xpGained));
    await Promise.all(
      classIds.map(async (classId) => {
        const ref = doc(this.firestore, `classes/${classId}/league/${user.uid}`);
        try {
          const snap = await getDoc(ref);
          const prev = snap.exists() ? (snap.data() as LeagueEntry) : null;
          const entry: LeagueEntry = {
            uid: user.uid,
            displayName: (user.displayName || 'Öğrenci').slice(0, 80),
            week,
            xp: prev?.week === week ? prev.xp + gain : gain,
          };
          await setDoc(ref, entry);
        } catch (err) {
          console.warn(`[Classroom] league for ${classId} not saved:`, err);
        }
      })
    );
  }

  /** This week's league of a class, highest XP first. */
  league(classId: string): Observable<LeagueEntry[]> {
    const week = isoWeekKey(Date.now());
    return (
      collectionData(
        query(collection(this.firestore, `classes/${classId}/league`), where('week', '==', week))
      ) as Observable<LeagueEntry[]>
    ).pipe(
      map((list) => [...list].sort((a, b) => b.xp - a.xp)),
      catchError(() => of([]))
    );
  }

  /** For a teacher dashboard: how many students in a class. */
  async memberCount(classId: string): Promise<number> {
    const snap = await getCountFromServer(collection(this.firestore, `classes/${classId}/members`));
    return snap.data().count;
  }
}
