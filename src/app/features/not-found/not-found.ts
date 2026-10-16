import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/services/auth';
import { isTeacher } from '../../models/user';

/** Shown for any address the app doesn't know (and for /yonetim to non-admins). */
@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  templateUrl: './not-found.html',
  styleUrl: './not-found.scss',
})
export class NotFound {
  private auth = inject(AuthService);
  appUser = toSignal(this.auth.appUser$, { initialValue: null });
  home = computed(() => {
    const u = this.appUser();
    if (!u) return { link: '/', label: 'Ana sayfaya dön' };
    return isTeacher(u) ? { link: '/ogretmen', label: 'Öğretmen paneline dön' } : { link: '/panel', label: 'Panele dön' };
  });
}
