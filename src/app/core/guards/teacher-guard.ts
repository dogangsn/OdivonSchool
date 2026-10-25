import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { AuthService } from '../services/auth';

/** Teacher area: teachers and admins only. UX gate; Firestore rules are the real boundary. */
export const teacherGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.appUser$.pipe(
    filter((u) => u !== undefined),
    take(1),
    map((u) => {
      if (u && auth.needsVerification()) return router.createUrlTree(['/eposta-dogrula']);
      if (u?.role === 'teacher' || u?.role === 'admin') return true;
      return router.createUrlTree([u ? '/panel' : '/giris']);
    })
  );
};
