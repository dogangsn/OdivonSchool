import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from './core/services/auth';
import { GuestQuotaService } from './core/services/guest-quota';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private auth = inject(AuthService);
  private router = inject(Router);
  guestQuota = inject(GuestQuotaService);

  appUser = toSignal(this.auth.appUser$, { initialValue: null });

  async logout() {
    await this.auth.logout();
    this.router.navigate(['/giris']);
  }
}
