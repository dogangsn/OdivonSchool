import { EducationLevel } from './test-category';

/** 'user' is the legacy student role (accounts created before roles existed). */
export type UserRole = 'student' | 'teacher' | 'admin' | 'user';

/** Roles a person may pick for themselves at sign-up. */
export type SignupRole = 'student' | 'teacher';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  gradeLevel?: EducationLevel;
  grade?: number | null; // sınıf 1-12 (null/missing for KPSS)
  createdAt: number; // epoch ms
  subscriptionId?: string;
  subscriptionStatus: 'active' | 'trial' | 'expired' | 'none';
  subscriptionExpiresAt?: number;

  // Teacher profile
  school?: string;
  branch?: string;
  teacherVerified?: boolean; // set by admins only

  // Notifications: pool updates newer than this are shown as unread.
  lastNotifSeenAt?: number;

  // Gamification
  xp?: number;
  streakDays?: number;
  lastPlayedDate?: string; // YYYY-MM-DD (local)
  badges?: string[];

  // Öğretmen sınıfları the student joined (membership docs are the source of truth)
  classIds?: string[];

  // Notification preferences (missing = on)
  notifyPush?: boolean;
  notifyEmail?: boolean;

  /** Set when a teacher created this account (kullanıcı adı + şifre, no real e-mail). */
  createdByTeacher?: string;
  username?: string;
}

/** Profile chosen on the sign-up form. */
export interface SignupProfile {
  role: SignupRole;
  gradeLevel: EducationLevel;
  grade: number | null;
  school?: string;
  branch?: string;
}

export function isStudent(user: Pick<AppUser, 'role'> | null | undefined): boolean {
  return !!user && (user.role === 'student' || user.role === 'user');
}

export function isTeacher(user: Pick<AppUser, 'role'> | null | undefined): boolean {
  return !!user && user.role === 'teacher';
}

export function roleLabel(role: UserRole | undefined): string {
  switch (role) {
    case 'admin':
      return 'Yönetici';
    case 'teacher':
      return 'Öğretmen';
    default:
      return 'Öğrenci';
  }
}
