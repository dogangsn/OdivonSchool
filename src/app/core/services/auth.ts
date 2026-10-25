import { Injectable, inject } from '@angular/core';
import {
  Auth,
  authState,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  User,
} from '@angular/fire/auth';
import { Firestore, doc, docData, setDoc, getDoc } from '@angular/fire/firestore';
import { Observable, switchMap, of, firstValueFrom, filter, take } from 'rxjs';
import { AppUser, SignupProfile } from '../../models/user';
import { isStudentAccountEmail } from '../student-accounts';

/**
 * Accounts created before e-mail verification was introduced keep working
 * without it; everyone who signs up after this moment must verify.
 */
export const EMAIL_VERIFICATION_CUTOFF = Date.parse('2026-10-25T01:00:00Z');

/** True when this signed-in user must confirm their e-mail before using the app. */
export function needsEmailVerification(user: User | null | undefined): boolean {
  if (!user || user.emailVerified) return false;
  // Teacher-made student accounts use an address nobody receives mail at.
  if (isStudentAccountEmail(user.email)) return false;
  const created = Date.parse(user.metadata?.creationTime ?? '');
  if (Number.isFinite(created) && created < EMAIL_VERIFICATION_CUTOFF) return false;
  return true;
}

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
    try {
      await this.sendVerificationEmail();
    } catch (err) {
      // The verify page offers a resend button, so sign-up still succeeds.
      console.warn('[AuthService] sendEmailVerification error:', err);
    }
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

  /** Sends (or re-sends) the verification e-mail to the signed-in user. */
  async sendVerificationEmail() {
    const user = this.auth.currentUser;
    if (!user) throw new Error('not-signed-in');
    await sendEmailVerification(user, {
      url: `${location.origin}/eposta-dogrula`,
    });
  }

  /**
   * Refreshes the Firebase user so a link clicked in another tab is seen.
   * Returns true once the e-mail is verified (or verification isn't needed).
   */
  async refreshVerification(): Promise<boolean> {
    const user = this.auth.currentUser;
    if (!user) return false;
    await user.reload();
    if (user.emailVerified) await user.getIdToken(true);
    return !needsEmailVerification(this.auth.currentUser);
  }

  /** Whether the current Firebase user still has to verify their e-mail. */
  needsVerification(): boolean {
    return needsEmailVerification(this.auth.currentUser);
  }

  /** Landing page for the signed-in user's role (waits for the user doc). */
  async homeUrl(): Promise<string> {
    if (this.needsVerification()) return '/eposta-dogrula';
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
    return sendPasswordResetEmail(this.auth, email.trim());
  }
}
