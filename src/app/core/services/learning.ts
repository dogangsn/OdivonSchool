import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  getDoc,
  getDocs,
  increment,
  setDoc,
  writeBatch,
} from '@angular/fire/firestore';
import { Observable, catchError, map, of } from 'rxjs';
import { AppUser } from '../../models/user';
import { Question } from '../../models/question';
import { AnsweredPoolQuestion, OutcomeStat, OutcomeStatsDoc, ReviewCard } from '../../models/learning';
import { nextCard, outcomeDeltas } from '../learning';

/** Akıllı tekrar: review cards and kazanım totals for the signed-in student. */
@Injectable({ providedIn: 'root' })
export class LearningService {
  private firestore = inject(Firestore);

  cards(uid: string): Observable<ReviewCard[]> {
    return (
      collectionData(collection(this.firestore, `users/${uid}/reviewCards`)) as Observable<ReviewCard[]>
    ).pipe(catchError(() => of([])));
  }

  outcomeStats(uid: string): Observable<OutcomeStat[]> {
    return (docData(doc(this.firestore, `users/${uid}/learning/outcomes`)) as Observable<OutcomeStatsDoc | undefined>).pipe(
      map((d) => Object.values(d?.outcomes ?? {})),
      catchError(() => of([]))
    );
  }

  /** Pool questions by id (review cards keep only the id). */
  async questions(ids: string[]): Promise<Question[]> {
    const snaps = await Promise.all(
      ids.map((id) => getDoc(doc(this.firestore, `questions/${id}`)).catch(() => null))
    );
    return snaps
      .filter((s) => !!s && s.exists())
      .map((s) => ({ ...(s!.data() as Question), id: s!.id }));
  }

  /**
   * After a test, quiz or review: update the cards, the student's kazanım
   * totals and the kazanım columns their teachers see. Never throws; a failed
   * write only means a card is scheduled a little differently.
   */
  async record(user: AppUser, answers: AnsweredPoolQuestion[]): Promise<void> {
    if (answers.length === 0) return;
    try {
      const now = Date.now();
      const deck = await getDocs(collection(this.firestore, `users/${user.uid}/reviewCards`));
      const byId = new Map(deck.docs.map((d) => [d.id, d.data() as ReviewCard]));
      const batch = writeBatch(this.firestore);
      let writes = 0;
      for (const a of answers) {
        const ref = doc(this.firestore, `users/${user.uid}/reviewCards/${a.questionId}`);
        const change = nextCard(byId.get(a.questionId) ?? null, a, now);
        if (change.kind === 'save') {
          batch.set(ref, change.card);
          byId.set(a.questionId, change.card);
          writes++;
        } else if (change.kind === 'retire') {
          batch.delete(ref);
          byId.delete(a.questionId);
          writes++;
        }
      }

      const deltas = outcomeDeltas(answers);
      if (deltas.size) {
        const outcomes: Record<string, unknown> = {};
        const classOutcomes: Record<string, unknown> = {};
        for (const [key, d] of deltas) {
          outcomes[key] = { code: d.code, categoryId: d.categoryId, correct: increment(d.correct), total: increment(d.total), lastAt: now };
          classOutcomes[key] = { code: d.code, correct: increment(d.correct), total: increment(d.total) };
        }
        batch.set(doc(this.firestore, `users/${user.uid}/learning/outcomes`), { outcomes, updatedAt: now }, { merge: true });
        writes++;
        await batch.commit();
        // Teachers' tracking: only classes where the student already has a progress doc.
        await Promise.all(
          (user.classIds ?? []).map((classId) =>
            setDoc(
              doc(this.firestore, `classes/${classId}/progress/${user.uid}`),
              { outcomes: classOutcomes, lastActiveAt: now },
              { merge: true }
            ).catch(() => undefined)
          )
        );
        return;
      }
      if (writes) await batch.commit();
    } catch (err) {
      console.warn('[Learning] review cards not saved:', err);
    }
  }
}

/** Shapes a pool question + the student's choice for `record`. */
export function answeredPool(q: Question, correct: boolean): AnsweredPoolQuestion {
  return {
    questionId: q.id,
    categoryId: q.categoryId,
    subject: q.subject ?? '',
    outcomeCode: q.outcomeCode?.trim() || null,
    correct,
  };
}
