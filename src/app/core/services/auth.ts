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
  updateProfile,
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
    const cleanEmail = email.trim();
    const cleanName = displayName.trim();
    const cred = await createUserWithEmailAndPassword(this.auth, cleanEmail, password);

    if (cleanName) {
      try {
        await updateProfile(cred.user, { displayName: cleanName });
      } catch (err) {
        console.warn('[AuthService] updateProfile displayName error:', err);
      }
    }

    const newUser: AppUser = {
      uid: cred.user.uid,
      email: cleanEmail,
      displayName: cleanName || 'Öğrenci',
      role: 'user',
      gradeLevel: gradeLevel ?? 'ortaokul',
      createdAt: Date.now(),
      subscriptionStatus: 'none',
    };
    await setDoc(doc(this.firestore, `users/${cred.user.uid}`), newUser);
    return cred;
  }

  async login(email: string, password: string) {
    const cleanEmail = email.trim();
    const cred = await signInWithEmailAndPassword(this.auth, cleanEmail, password);

    // Self-healing: if Firestore doc is missing for any reason, initialize it
    try {
      const userDocRef = doc(this.firestore, `users/${cred.user.uid}`);
      const snap = await getDoc(userDocRef);
      if (!snap.exists()) {
        const newUser: AppUser = {
          uid: cred.user.uid,
          email: cred.user.email ?? cleanEmail,
          displayName: cred.user.displayName || 'Öğrenci',
          role: 'user',
          gradeLevel: 'ortaokul',
          createdAt: Date.now(),
          subscriptionStatus: 'none',
        };
        await setDoc(userDocRef, newUser);
      }
    } catch (err) {
      console.warn('[AuthService] Ensure user doc exists on login failed:', err);
    }

    return cred;
  }

  async loginWithGoogle(gradeLevel?: 'ilkokul' | 'ortaokul' | 'lise' | 'kpss') {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const cred = await signInWithPopup(this.auth, provider);
    const userDocRef = doc(this.firestore, `users/${cred.user.uid}`);
    const snap = await getDoc(userDocRef);

    if (!snap.exists()) {
      const newUser: AppUser = {
        uid: cred.user.uid,
        email: cred.user.email ?? '',
        displayName: cred.user.displayName || 'Öğrenci',
        role: 'user',
        gradeLevel: gradeLevel ?? 'ortaokul',
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
