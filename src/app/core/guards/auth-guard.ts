import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs';
import { AuthService } from '../services/auth';

/** Allows access only to signed-in users; otherwise redirects to /giris. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.authState$.pipe(
    take(1),
    map((fbUser) => (fbUser ? true : router.createUrlTree(['/giris'])))
  );
};
