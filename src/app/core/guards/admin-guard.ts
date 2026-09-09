import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs';
import { AuthService } from '../services/auth';

/**
 * Allows access only to users whose Firestore user doc has role === 'admin'.
 * IMPORTANT: this is a UX-level gate only. The real protection must be
 * Firestore Security Rules (see firestore.rules) that check the same
 * condition (or, better, a custom auth claim) before allowing reads of
 * other users' data. Never rely on the hidden route path alone.
 */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.appUser$.pipe(
    take(1),
    map((appUser) => (appUser?.role === 'admin' ? true : router.createUrlTree(['/giris'])))
  );
};
