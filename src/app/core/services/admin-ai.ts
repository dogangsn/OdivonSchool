import { Injectable, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import {
  Firestore,
  collection,
  collectionData,
  query,
  where,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Question } from '../../models/question';

/**
 * Client-side wrapper around the admin-only Cloud Functions:
 * generateQuestions, reviewQuestion, setUserRole. All real authorization
 * happens server-side (the functions re-check the caller's role); this
 * service is just a thin, typed convenience layer for the admin panel.
 */
@Injectable({ providedIn: 'root' })
export class AdminAiService {
  private functions = inject(Functions);
  private firestore = inject(Firestore);

  generateQuestions(categoryId: string, count = 5) {
    const call = httpsCallable<{ categoryId: string; count: number }, { createdCount: number }>(
      this.functions,
      'generateQuestions'
    );
    return call({ categoryId, count });
  }

  reviewQuestion(questionId: string, decision: 'approved' | 'rejected') {
    const call = httpsCallable<{ questionId: string; decision: string }, { ok: boolean }>(
      this.functions,
      'reviewQuestion'
    );
    return call({ questionId, decision });
  }

  draftQuestions(): Observable<Question[]> {
    const ref = collection(this.firestore, 'questions');
    const q = query(ref, where('reviewStatus', '==', 'draft'));
    return collectionData(q, { idField: 'id' }) as Observable<Question[]>;
  }
}
