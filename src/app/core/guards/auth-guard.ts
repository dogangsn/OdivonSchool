import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs';
import { AuthService, needsEmailVerification } from '../services/auth';

/**
 * Allows access only to signed-in users; otherwise /giris, which comes back here after login.
 * New accounts that haven't confirmed their e-mail go to /eposta-dogrula first.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.authState$.pipe(
    take(1),
    map((fbUser) => {
      if (!fbUser) return router.createUrlTree(['/giris'], { queryParams: { donus: state.url } });
      if (needsEmailVerification(fbUser)) {
        return router.createUrlTree(['/eposta-dogrula'], { queryParams: { donus: state.url } });
      }
      return true;
    })
  );
};
