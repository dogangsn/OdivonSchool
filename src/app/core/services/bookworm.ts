import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  orderBy,
  query,
  setDoc,
} from '@angular/fire/firestore';
import { Observable, catchError, of } from 'rxjs';
import { AppUser } from '../../models/user';
import { BookDraft, BookEntry, BookwormSummary, bookwormSummary } from '../../games/bookworm';

/**
 * Okuma Kurdu: the student's own book log (users/{uid}/books) and a small
 * per-class summary (classes/{classId}/bookworm/{uid}) for the class map.
 */
@Injectable({ providedIn: 'root' })
export class BookwormService {
  private firestore = inject(Firestore);

  myBooks(uid: string): Observable<BookEntry[]> {
    const q = query(collection(this.firestore, `users/${uid}/books`), orderBy('createdAt', 'desc'));
    return (collectionData(q, { idField: 'id' }) as Observable<BookEntry[]>).pipe(
      catchError(() => of([] as BookEntry[]))
    );
  }

  async addBook(user: AppUser, book: BookDraft, current: BookEntry[]): Promise<void> {
    const createdAt = Date.now();
    const ref = await addDoc(collection(this.firestore, `users/${user.uid}/books`), { ...book, createdAt });
    await this.syncClasses(user, [{ ...book, id: ref.id, createdAt }, ...current]);
  }

  async removeBook(user: AppUser, id: string, current: BookEntry[]): Promise<void> {
    await deleteDoc(doc(this.firestore, `users/${user.uid}/books/${id}`));
    await this.syncClasses(user, current.filter((b) => b.id !== id));
  }

  /** Classmates' and the teacher's view of a class. */
  classBookworms(classId: string): Observable<BookwormSummary[]> {
    return (collectionData(collection(this.firestore, `classes/${classId}/bookworm`)) as Observable<BookwormSummary[]>).pipe(
      catchError(() => of([] as BookwormSummary[]))
    );
  }

  private async syncClasses(user: AppUser, books: BookEntry[]) {
    const summary = bookwormSummary(user.uid, user.displayName || '', books, Date.now());
    await Promise.all(
      (user.classIds ?? []).map((classId) =>
        setDoc(doc(this.firestore, `classes/${classId}/bookworm/${user.uid}`), summary).catch((err) =>
          console.warn(`[Bookworm] summary for ${classId} not saved:`, err)
        )
      )
    );
  }
}
