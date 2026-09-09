import { Injectable, inject } from '@angular/core';
import {
  Auth,
  authState,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
} from '@angular/fire/auth';
import { Firestore, doc, docData, setDoc, getDoc } from '@angular/fire/firestore';
import { Observable, switchMap, of } from 'rxjs';
import { AppUser } from '../../models/user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);

  /** Firebase auth user (or null) as an observable. */
  readonly authState$ = authState(this.auth);

  /** App-level user document (role, subscription status, etc). */
  readonly appUser$: Observable<AppUser | null> = this.authState$.pipe(
    switchMap((fbUser) => {
      if (!fbUser) return of(null);
      const ref = doc(this.firestore, `users/${fbUser.uid}`);
      return docData(ref) as Observable<AppUser>;
    })
  );

  async register(
    email: string,
    password: string,
    displayName: string,
    gradeLevel?: 'ilkokul' | 'ortaokul' | 'lise' | 'kpss'
  ) {
    const cred = await createUserWithEmailAndPassword(this.auth, email, password);
    const newUser: AppUser = {
      uid: cred.user.uid,
      email,
      displayName,
      role: 'user',
      gradeLevel: gradeLevel ?? 'ortaokul',
      createdAt: Date.now(),
      subscriptionStatus: 'none',
    };
    await setDoc(doc(this.firestore, `users/${cred.user.uid}`), newUser);
    return cred;
  }

  login(email: string, password: string) {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  async loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(this.auth, provider);
    const userDocRef = doc(this.firestore, `users/${cred.user.uid}`);
    const snap = await getDoc(userDocRef);

    if (!snap.exists()) {
      const newUser: AppUser = {
        uid: cred.user.uid,
        email: cred.user.email ?? '',
        displayName: cred.user.displayName ?? 'Öğrenci',
        role: 'user',
        createdAt: Date.now(),
        subscriptionStatus: 'none',
      };
      await setDoc(userDocRef, newUser);
    }
    return cred;
  }

  logout() {
    return signOut(this.auth);
  }

  sendPasswordReset(email: string) {
    return sendPasswordResetEmail(this.auth, email);
  }
}
