import { Injectable, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  Firestore,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { Question } from '../../models/question';
import { SubscriptionEvent } from '../../models/subscription';
import { TestCategory } from '../../models/test-category';
import { AppUser } from '../../models/user';

/** Approved / draft question counts of one konu (category). */
export interface CategoryPoolStat {
  categoryId: string;
  approved: number;
  draft: number;
}

export interface AdminNote {
  text: string;
  updatedAt: number;
  byName: string;
}

/** Fields an admin may change on a user from the panel. `null` removes the field. */
export type UserPatch = {
  [K in keyof AppUser]?: AppUser[K] | null;
};

/**
 * Owner console (/yonetim) data access. Everything here needs the admin role;
 * firestore.rules enforce that, this service is only the client side.
 */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  // ---- Users & subscriptions ----

  /**
   * Updates a user and writes one history line in the same batch, so the
   * subscription history never misses a change made from the panel.
   */
  async updateUser(
    user: Pick<AppUser, 'uid' | 'email'>,
    patch: UserPatch,
    event: { type: SubscriptionEvent['type']; summary: string }
  ): Promise<void> {
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      data[key] = value === null ? deleteField() : value;
    }
    const me = this.auth.currentUser;
    const batch = writeBatch(this.firestore);
    batch.update(doc(this.firestore, `users/${user.uid}`), data);
    batch.set(doc(collection(this.firestore, 'subscriptionEvents')), {
      uid: user.uid,
      email: user.email ?? '',
      type: event.type,
      summary: event.summary.slice(0, 300),
      byUid: me?.uid ?? '',
      byName: me?.displayName || me?.email || 'Yönetici',
      at: Date.now(),
    });
    await batch.commit();
  }

  /** History of one user, newest first (sorted here so no composite index is needed). */
  async eventsForUser(uid: string): Promise<SubscriptionEvent[]> {
    const snap = await getDocs(
      query(collection(this.firestore, 'subscriptionEvents'), where('uid', '==', uid))
    );
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<SubscriptionEvent, 'id'>) }))
      .sort((a, b) => b.at - a.at);
  }

  async noteFor(uid: string): Promise<AdminNote | null> {
    const snap = await getDoc(doc(this.firestore, `adminNotes/${uid}`));
    return snap.exists() ? (snap.data() as AdminNote) : null;
  }

  async saveNote(uid: string, text: string): Promise<void> {
    const me = this.auth.currentUser;
    await setDoc(doc(this.firestore, `adminNotes/${uid}`), {
      text: text.slice(0, 4000),
      updatedAt: Date.now(),
      byName: me?.displayName || me?.email || 'Yönetici',
    });
  }

  // ---- Question pool ----

  /** Last pool count, kept so switching tabs doesn't count everything again. */
  cachedPoolStats: { at: number; stats: CategoryPoolStat[] } | null = null;

  /** Pool-wide totals (3 count aggregations). */
  async poolTotals(): Promise<{ approved: number; draft: number; teacherDrafts: number }> {
    const ref = collection(this.firestore, 'questions');
    const c = async (...filters: [string, string][]) =>
      (await getCountFromServer(query(ref, ...filters.map(([f, v]) => where(f, '==', v))))).data().count;
    const [approved, draft, teacherDrafts] = await Promise.all([
      c(['reviewStatus', 'approved']),
      c(['reviewStatus', 'draft']),
      c(['reviewStatus', 'draft'], ['source', 'teacher']),
    ]);
    return { approved, draft, teacherDrafts };
  }

  /**
   * Approved and draft counts for every konu, using count aggregations
   * (1 read per 1000 questions) instead of downloading the whole pool.
   */
  async poolStats(categories: TestCategory[]): Promise<CategoryPoolStat[]> {
    const ref = collection(this.firestore, 'questions');
    const count = async (categoryId: string, status: string) =>
      (
        await getCountFromServer(
          query(ref, where('categoryId', '==', categoryId), where('reviewStatus', '==', status))
        )
      ).data().count;

    const results: CategoryPoolStat[] = [];
    const queue = categories.slice();
    // A few at a time keeps the browser from opening hundreds of requests at once.
    const workers = Array.from({ length: 8 }, async () => {
      while (queue.length) {
        const c = queue.shift()!;
        const [approved, draft] = await Promise.all([count(c.id, 'approved'), count(c.id, 'draft')]);
        results.push({ categoryId: c.id, approved, draft });
      }
    });
    await Promise.all(workers);
    this.cachedPoolStats = { at: Date.now(), stats: results };
    return results;
  }

  /** Every question of one konu, any status, newest first. */
  async questionsInCategory(categoryId: string): Promise<Question[]> {
    const snap = await getDocs(
      query(collection(this.firestore, 'questions'), where('categoryId', '==', categoryId))
    );
    return snap.docs
      .map((d) => ({ ...(d.data() as Question), id: d.id }))
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }

  async setQuestionStatus(id: string, reviewStatus: Question['reviewStatus']): Promise<void> {
    await updateDoc(doc(this.firestore, `questions/${id}`), { reviewStatus });
  }

  async updateQuestion(id: string, updates: Partial<Question>): Promise<void> {
    await updateDoc(doc(this.firestore, `questions/${id}`), updates);
  }

  async deleteQuestion(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, `questions/${id}`));
  }
}
