import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from './core/services/auth';
import { GuestQuotaService } from './core/services/guest-quota';
import { NotificationBell } from './features/shared/notification-bell/notification-bell';
import { UpdateModal } from './features/shared/update-modal/update-modal';
import { AppVersionService } from './core/services/app-version';
import { isStudent, canPlayGames, roleLabel } from './models/user';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NotificationBell, UpdateModal],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private auth = inject(AuthService);
  private router = inject(Router);
  guestQuota = inject(GuestQuotaService);
  appVersion = inject(AppVersionService).version;

  appUser = toSignal(this.auth.appUser$, { initialValue: null });
  showBell = computed(() => isStudent(this.appUser()));
  showGames = computed(() => canPlayGames(this.appUser()));
  readonly roleLabel = roleLabel;

  async logout() {
    await this.auth.logout();
    this.router.navigate(['/giris']);
  }
}
