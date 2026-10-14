import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { Observable, map, of, switchMap } from 'rxjs';
import { AuthService } from './auth';
import { AppUser, isStudent } from '../../models/user';
import { PoolUpdate } from '../../models/pool-update';
import { Question } from '../../models/question';
import { TestCategory } from '../../models/test-category';

const FEED_LIMIT = 30;
/** Firestore `in` queries accept at most 30 values. */
const IN_CHUNK = 30;

/** Pool updates that concern this student's sınıf. */
export function updatesForUser(updates: PoolUpdate[], user: Pick<AppUser, 'grade'>): PoolUpdate[] {
  const grade = user.grade;
  return updates.filter((u) => !grade || !u.grades?.length || u.grades.includes(grade));
}

/**
 * In-app notifications ("Havuza yeni soru geldi"). Admin approvals write one
 * `poolUpdates` document per category; each student's bell shows the ones for
 * their level + sınıf that are newer than `lastNotifSeenAt`.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private firestore = inject(Firestore);
  private auth = inject(AuthService);

  private readonly feed$: Observable<PoolUpdate[]> = this.auth.appUser$.pipe(
    switchMap((user) => {
      if (!user || !isStudent(user) || !user.gradeLevel) return of([]);
      const q = query(
        collection(this.firestore, 'poolUpdates'),
        where('level', '==', user.gradeLevel),
        orderBy('createdAt', 'desc'),
        limit(FEED_LIMIT)
      );
      return (collectionData(q, { idField: 'id' }) as Observable<PoolUpdate[]>).pipe(
        map((list) => updatesForUser(list, user))
      );
    })
  );

  private readonly user = toSignal(this.auth.appUser$, { initialValue: null });
  readonly items = toSignal(this.feed$, { initialValue: [] as PoolUpdate[] });
  readonly unreadCount = computed(() => {
    const seen = this.user()?.lastNotifSeenAt ?? 0;
    return this.items().filter((u) => u.createdAt > seen).length;
  });

  isUnread(update: PoolUpdate): boolean {
    return update.createdAt > (this.user()?.lastNotifSeenAt ?? 0);
  }

  async markAllSeen(): Promise<void> {
    const user = this.user();
    if (!user || this.unreadCount() === 0) return;
    await updateDoc(doc(this.firestore, `users/${user.uid}`), { lastNotifSeenAt: Date.now() });
  }

  /**
   * Called by the admin screen after questions are approved: groups them by
   * category and writes one notice per category (so a bulk approval of 50
   * questions doesn't produce 50 notifications).
   */
  async recordApprovals(questionIds: string[]): Promise<void> {
    if (questionIds.length === 0) return;
    const counts = new Map<string, number>();
    for (let i = 0; i < questionIds.length; i += IN_CHUNK) {
      const chunk = questionIds.slice(i, i + IN_CHUNK);
      const snap = await getDocs(
        query(collection(this.firestore, 'questions'), where(documentId(), 'in', chunk))
      );
      for (const d of snap.docs) {
        const categoryId = (d.data() as Question).categoryId;
        if (categoryId) counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
      }
    }

    const batch = writeBatch(this.firestore);
    const now = Date.now();
    for (const [categoryId, count] of counts) {
      const catSnap = await getDoc(doc(this.firestore, `categories/${categoryId}`));
      if (!catSnap.exists()) continue;
      const cat = catSnap.data() as TestCategory;
      const update: Omit<PoolUpdate, 'id'> = {
        level: cat.level,
        grades: cat.grades ?? [],
        categoryId,
        subject: cat.subject,
        topic: cat.topic,
        count,
        createdAt: now,
      };
      batch.set(doc(collection(this.firestore, 'poolUpdates')), update);
    }
    await batch.commit();
  }
}
