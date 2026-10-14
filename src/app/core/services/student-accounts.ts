import { Injectable, inject } from '@angular/core';
import { FirebaseApp, deleteApp, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  inMemoryPersistence,
  initializeAuth,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc as rawDoc, getFirestore, setDoc as rawSetDoc } from 'firebase/firestore';
import { Firestore, collection, collectionData, deleteDoc, doc, orderBy, query, setDoc } from '@angular/fire/firestore';
import { Observable, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Classroom, ClassMember } from '../../models/classroom';
import { levelForGrade } from '../../models/test-category';
import { newUserDoc } from './auth';
import { MAX_ACCOUNTS_PER_BATCH, makePassword, makeUsername, usernameToEmail } from '../student-accounts';

/** classes/{classId}/accounts/{uid}: the username of an account the teacher opened. */
export interface StudentAccount {
  uid: string;
  name: string;
  username: string;
  createdAt: number;
}

/**
 * A freshly opened account. The password lives only here, in the teacher's
 * browser, so the login cards can be printed right away; it is never stored.
 */
export interface AccountResult {
  name: string;
  account?: StudentAccount;
  password?: string;
  error?: string;
}

/**
 * Lets a teacher open accounts for students who have no e-mail. Each account
 * is created in a separate, in-memory Firebase instance that signs in as the
 * new student, writes the student's own documents (so the normal security
 * rules apply) and signs out. The teacher's session is never touched.
 */
@Injectable({ providedIn: 'root' })
export class StudentAccountService {
  private firestore = inject(Firestore);

  /** Last batch per class, kept in memory for the print page. */
  private lastBatch = new Map<string, AccountResult[]>();

  freshResults(classId: string): AccountResult[] {
    return this.lastBatch.get(classId) ?? [];
  }

  accounts(classId: string): Observable<StudentAccount[]> {
    return (
      collectionData(
        query(collection(this.firestore, `classes/${classId}/accounts`), orderBy('createdAt', 'asc'))
      ) as Observable<StudentAccount[]>
    ).pipe(catchError(() => of([])));
  }

  async forget(classId: string, uid: string): Promise<void> {
    await deleteDoc(doc(this.firestore, `classes/${classId}/accounts/${uid}`));
  }

  async createAccounts(
    classroom: Classroom,
    names: string[],
    onProgress?: (done: number, total: number) => void
  ): Promise<AccountResult[]> {
    const list = names.slice(0, MAX_ACCOUNTS_PER_BATCH);
    const app = initializeApp(environment.firebase, `student-accounts-${Date.now()}`);
    const results: AccountResult[] = [];
    try {
      for (const [i, name] of list.entries()) {
        results.push(await this.createOne(app, classroom, name));
        onProgress?.(i + 1, list.length);
      }
    } finally {
      await deleteApp(app).catch(() => undefined);
    }
    this.lastBatch.set(classroom.id, results);
    return results;
  }

  private async createOne(app: FirebaseApp, classroom: Classroom, name: string): Promise<AccountResult> {
    const auth = initializeAuthOnce(app);
    const db = getFirestore(app);
    // A clash on the random suffix is rare; try a few usernames.
    for (let attempt = 0; attempt < 3; attempt++) {
      const username = makeUsername(name);
      const password = makePassword();
      try {
        const cred = await createUserWithEmailAndPassword(auth, usernameToEmail(username), password);
        const uid = cred.user.uid;
        await updateProfile(cred.user, { displayName: name });

        const grade = classroom.grade || undefined;
        const user = newUserDoc(uid, usernameToEmail(username), name, {
          role: 'student',
          gradeLevel: levelForGrade(classroom.grade || 4),
          grade: grade ?? 0,
        });
        await rawSetDoc(rawDoc(db, `users/${uid}`), {
          ...user,
          classIds: [classroom.id],
          createdByTeacher: classroom.teacherId,
          username,
          notifyEmail: false,
        });
        const member: ClassMember = {
          uid,
          displayName: name,
          grade: classroom.grade || null,
          joinCode: classroom.joinCode,
          joinedAt: Date.now(),
        };
        await rawSetDoc(rawDoc(db, `classes/${classroom.id}/members/${uid}`), member);
        await signOut(auth);

        const account: StudentAccount = { uid, name, username, createdAt: Date.now() };
        // Back in the teacher's own session: remember the username (not the password).
        await setDoc(doc(this.firestore, `classes/${classroom.id}/accounts/${uid}`), account);
        return { name, account, password };
      } catch (err: any) {
        await signOut(auth).catch(() => undefined);
        if (err?.code === 'auth/email-already-in-use') continue;
        return { name, error: accountError(err) };
      }
    }
    return { name, error: 'Kullanıcı adı üretilemedi, tekrar deneyin.' };
  }
}

const authByApp = new WeakMap<FirebaseApp, ReturnType<typeof initializeAuth>>();

function initializeAuthOnce(app: FirebaseApp) {
  let auth = authByApp.get(app);
  if (!auth) {
    auth = initializeAuth(app, { persistence: inMemoryPersistence });
    authByApp.set(app, auth);
  }
  return auth;
}

function accountError(err: any): string {
  switch (err?.code) {
    case 'auth/too-many-requests':
      return 'Çok fazla hesap art arda açıldı. Birkaç dakika sonra kalanlar için tekrar deneyin.';
    case 'auth/operation-not-allowed':
      return 'E-posta/şifre ile giriş Firebase ayarlarında kapalı.';
    case 'auth/network-request-failed':
      return 'İnternet bağlantısı kesildi.';
    case 'permission-denied':
      return 'Hesap açıldı ama sınıfa eklenemedi (izin hatası).';
    default:
      return err?.message ?? 'Bilinmeyen hata';
  }
}
