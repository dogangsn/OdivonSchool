import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  query,
  where,
  orderBy,
  limit as fbLimit,
  addDoc,
  updateDoc,
  serverTimestamp,
} from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';
import { TestCategory } from '../../models/test-category';
import { Question } from '../../models/question';
import { TestAttempt } from '../../models/test-attempt';
import { AppUser } from '../../models/user';

/**
 * Thin wrapper around Firestore collections used across the app.
 * Keeping all collection paths here avoids typos/duplication elsewhere.
 */
@Injectable({ providedIn: 'root' })
export class FirestoreService {
  private firestore = inject(Firestore);

  // ---- Categories ----
  allCategories(): Observable<TestCategory[]> {
    const ref = collection(this.firestore, 'categories');
    return (collectionData(ref, { idField: 'id' }) as Observable<TestCategory[]>).pipe(
      map((list) => list.slice().sort((a, b) => {
        if (a.level !== b.level) return a.level.localeCompare(b.level);
        return (a.order ?? 0) - (b.order ?? 0);
      }))
    );
  }

  categoriesByLevel(level: string): Observable<TestCategory[]> {
    const ref = collection(this.firestore, 'categories');
    const q = query(ref, where('level', '==', level));
    return (collectionData(q, { idField: 'id' }) as Observable<TestCategory[]>).pipe(
      map((list) => list.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
    );
  }

  categoryById(id: string): Observable<TestCategory | undefined> {
    const ref = doc(this.firestore, `categories/${id}`);
    return docData(ref, { idField: 'id' }) as Observable<TestCategory | undefined>;
  }

  // ---- Questions ----
  questionsForCategory(categoryId: string, count: number): Observable<Question[]> {
    const ref = collection(this.firestore, 'questions');
    const q = query(
      ref,
      where('categoryId', '==', categoryId),
      where('reviewStatus', '==', 'approved'),
      fbLimit(count)
    );
    return collectionData(q, { idField: 'id' }) as Observable<Question[]>;
  }

  // ---- Test attempts (history + success rates) ----
  saveAttempt(attempt: Omit<TestAttempt, 'id'>) {
    const ref = collection(this.firestore, 'testAttempts');
    return addDoc(ref, attempt);
  }

  attemptsForUser(userId: string): Observable<TestAttempt[]> {
    const ref = collection(this.firestore, 'testAttempts');
    const q = query(ref, where('userId', '==', userId), orderBy('startedAt', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<TestAttempt[]>;
  }

  // ---- Admin: all subscribers / all attempts ----
  allUsers(): Observable<AppUser[]> {
    const ref = collection(this.firestore, 'users');
    return collectionData(ref, { idField: 'uid' }) as Observable<AppUser[]>;
  }

  allAttempts(): Observable<TestAttempt[]> {
    const ref = collection(this.firestore, 'testAttempts');
    const q = query(ref, orderBy('startedAt', 'desc'), fbLimit(500));
    return collectionData(q, { idField: 'id' }) as Observable<TestAttempt[]>;
  }

  userById(uid: string): Observable<AppUser> {
    return docData(doc(this.firestore, `users/${uid}`), { idField: 'uid' }) as Observable<AppUser>;
  }
}
