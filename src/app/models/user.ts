export type UserRole = 'user' | 'admin';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  gradeLevel?: 'ilkokul' | 'ortaokul' | 'lise' | 'kpss';
  grade?: number;    // sınıf 1-12 (optional, not used for KPSS)
  createdAt: number; // epoch ms
  subscriptionId?: string;
  subscriptionStatus: 'active' | 'trial' | 'expired' | 'none';
  subscriptionExpiresAt?: number;
}
