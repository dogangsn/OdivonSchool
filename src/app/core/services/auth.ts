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
import { Observable, switchMap, of, firstValueFrom, filter, take } from 'rxjs';
import { AppUser, SignupProfile } from '../../models/user';

/** Builds the Firestore user document for a new account. */
export function newUserDoc(
  uid: string,
  email: string,
  displayName: string,
  profile?: SignupProfile
): AppUser {
  const user: AppUser = {
    uid,
    email,
    displayName,
    role: profile?.role ?? 'student',
    gradeLevel: profile?.gradeLevel ?? 'ortaokul',
    createdAt: Date.now(),
    subscriptionStatus: 'none',
    lastNotifSeenAt: Date.now(),
    xp: 0,
    streakDays: 0,
    badges: [],
  };
  if (profile?.grade) user.grade = profile.grade;
  if (profile?.role === 'teacher') {
    if (profile.school?.trim()) user.school = profile.school.trim();
    if (profile.branch?.trim()) user.branch = profile.branch.trim();
  }
  return user;
}

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
    profile: SignupProfile
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

    const fallbackName = profile.role === 'teacher' ? 'Öğretmen' : 'Öğrenci';
    const newUser = newUserDoc(cred.user.uid, cleanEmail, cleanName || fallbackName, profile);
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
        const newUser = newUserDoc(
          cred.user.uid,
          cred.user.email ?? cleanEmail,
          cred.user.displayName || 'Öğrenci'
        );
        await setDoc(userDocRef, newUser);
      }
    } catch (err) {
      console.warn('[AuthService] Ensure user doc exists on login failed:', err);
    }

    return cred;
  }

  /**
   * Google sign-in. `profile` comes from the sign-up form; when it is missing
   * (login page) a brand-new account is created as a student and asked for
   * its sınıf on the dashboard.
   */
  async loginWithGoogle(profile?: SignupProfile) {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const cred = await signInWithPopup(this.auth, provider);
    const userDocRef = doc(this.firestore, `users/${cred.user.uid}`);
    const snap = await getDoc(userDocRef);

    if (!snap.exists()) {
      const newUser = newUserDoc(
        cred.user.uid,
        cred.user.email ?? '',
        cred.user.displayName || (profile?.role === 'teacher' ? 'Öğretmen' : 'Öğrenci'),
        profile
      );
      await setDoc(userDocRef, newUser);
    }
    return cred;
  }

  /** Landing page for the signed-in user's role (waits for the user doc). */
  async homeUrl(): Promise<string> {
    const user = await firstValueFrom(
      this.appUser$.pipe(
        filter((u) => u !== undefined),
        take(1)
      )
    );
    if (user?.role === 'teacher') return '/ogretmen';
    return '/panel';
  }

  logout() {
    return signOut(this.auth);
  }

  sendPasswordReset(email: string) {
    return sendPasswordResetEmail(this.auth, email);
  }
}
