import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from './core/services/auth';
import { GuestQuotaService } from './core/services/guest-quota';
import { NotificationBell } from './features/shared/notification-bell/notification-bell';
import { isStudent, canPlayGames, roleLabel } from './models/user';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NotificationBell],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private auth = inject(AuthService);
  private router = inject(Router);
  guestQuota = inject(GuestQuotaService);

  appUser = toSignal(this.auth.appUser$, { initialValue: null });
  showBell = computed(() => isStudent(this.appUser()));
  showGames = computed(() => canPlayGames(this.appUser()));
  readonly roleLabel = roleLabel;

  async logout() {
    await this.auth.logout();
    this.router.navigate(['/giris']);
  }
}
