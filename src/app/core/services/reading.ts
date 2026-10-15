import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { Observable, catchError, of } from 'rxjs';
import { AppUser } from '../../models/user';
import { ReadingSession, ReadingSummary, nextReadingSummary } from '../../games/reading-summary';

/**
 * Sesli Okuma Koçu: per-class reading summaries for the teacher
 * (classes/{classId}/reading/{uid}). Only numbers and struggled words are
 * stored, never audio.
 */
@Injectable({ providedIn: 'root' })
export class ReadingService {
  private firestore = inject(Firestore);

  async record(user: AppUser, session: ReadingSession): Promise<void> {
    const classIds = user.classIds ?? [];
    await Promise.all(
      classIds.map(async (classId) => {
        const ref = doc(this.firestore, `classes/${classId}/reading/${user.uid}`);
        try {
          const snap = await getDoc(ref);
          const prev = snap.exists() ? (snap.data() as ReadingSummary) : null;
          await setDoc(ref, nextReadingSummary(prev, user, session));
        } catch (err) {
          console.warn(`[Reading] summary for ${classId} not saved:`, err);
        }
      })
    );
  }

  /** Teacher: every student's summary in a class. */
  classReading(classId: string): Observable<ReadingSummary[]> {
    return (collectionData(collection(this.firestore, `classes/${classId}/reading`)) as Observable<ReadingSummary[]>).pipe(
      catchError(() => of([] as ReadingSummary[]))
    );
  }
}
