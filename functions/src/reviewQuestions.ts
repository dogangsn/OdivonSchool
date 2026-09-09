import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

interface ReviewRequest {
  questionId: string;
  decision: 'approved' | 'rejected';
}

async function assertIsAdmin(uid: string) {
  const db = admin.firestore();
  const callerDoc = await db.doc(`users/${uid}`).get();
  if (callerDoc.data()?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Bu işlem için yönetici yetkisi gerekiyor.');
  }
}

/**
 * Admin-only: approve or reject a single AI-generated (or manual) draft
 * question. Only approved questions are ever served to students - see
 * FirestoreService.questionsForCategory() and firestore.rules.
 */
export const reviewQuestion = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Giriş yapmanız gerekiyor.');
  }
  await assertIsAdmin(request.auth.uid);

  const { questionId, decision } = request.data as ReviewRequest;
  if (!questionId || !['approved', 'rejected'].includes(decision)) {
    throw new HttpsError('invalid-argument', 'questionId ve geçerli bir decision gerekli.');
  }

  await admin.firestore().doc(`questions/${questionId}`).update({ reviewStatus: decision });
  return { ok: true };
});

/**
 * One-time/admin-invoked: grants the 'admin' role to a target user by email.
 * Guarded so it can only be called by an existing admin - the very first
 * admin must instead be set directly in the Firestore console or via a
 * one-off script run with the Admin SDK, since there is no admin yet to
 * call this function.
 */
export const setUserRole = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Giriş yapmanız gerekiyor.');
  }
  await assertIsAdmin(request.auth.uid);

  const { targetUid, role } = request.data as { targetUid: string; role: 'user' | 'admin' };
  if (!targetUid || !['user', 'admin'].includes(role)) {
    throw new HttpsError('invalid-argument', 'targetUid ve geçerli bir role gerekli.');
  }

  await admin.firestore().doc(`users/${targetUid}`).update({ role });
  return { ok: true };
});
