import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
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

  /** Phone/tablet menu (the nav collapses behind a button under 1200px). */
  menuOpen = signal(false);

  constructor() {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => this.menuOpen.set(false));
  }

  toggleMenu() {
    this.menuOpen.update((v) => !v);
  }

  closeMenu() {
    this.menuOpen.set(false);
  }

  async logout() {
    await this.auth.logout();
    this.router.navigate(['/giris']);
  }
}
