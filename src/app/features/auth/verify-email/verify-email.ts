import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/services/auth';
import { getAuthErrorMessage } from '../../../core/utils/auth-error';

const RESEND_COOLDOWN_S = 60;
const POLL_MS = 5000;

/** Shown after sign-up until the user clicks the link in the verification e-mail. */
@Component({
  selector: 'app-verify-email',
  imports: [RouterLink],
  templateUrl: './verify-email.html',
  styleUrl: './verify-email.scss',
})
export class VerifyEmail implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);

  email = signal<string | null>(null);
  signedOut = signal(false);
  checking = signal(false);
  sending = signal(false);
  cooldown = signal(0);
  infoMessage = signal<string | null>(null);
  errorMessage = signal<string | null>(null);

  async ngOnInit() {
    const user = await firstValueFrom(this.auth.authState$);
    if (!user) {
      this.signedOut.set(true);
      return;
    }
    this.email.set(user.email);
    if (await this.isDone()) return;

    const poll = setInterval(() => this.isDone(), POLL_MS);
    const tick = setInterval(() => this.cooldown.update((s) => Math.max(0, s - 1)), 1000);
    this.destroyRef.onDestroy(() => {
      clearInterval(poll);
      clearInterval(tick);
    });
    // register() has just sent the first e-mail.
    this.cooldown.set(RESEND_COOLDOWN_S);
  }

  async checkNow() {
    this.errorMessage.set(null);
    this.infoMessage.set(null);
    this.checking.set(true);
    try {
      if (!(await this.isDone())) {
        this.infoMessage.set('Henüz doğrulanmamış görünüyor. E-postadaki bağlantıya tıkladıktan sonra tekrar dene.');
      }
    } finally {
      this.checking.set(false);
    }
  }

  async resend() {
    if (this.cooldown() > 0) return;
    this.errorMessage.set(null);
    this.infoMessage.set(null);
    this.sending.set(true);
    try {
      await this.auth.sendVerificationEmail();
      this.infoMessage.set('Doğrulama e-postasını yeniden gönderdik.');
      this.cooldown.set(RESEND_COOLDOWN_S);
    } catch (err) {
      this.errorMessage.set(getAuthErrorMessage(err));
    } finally {
      this.sending.set(false);
    }
  }

  async logout() {
    await this.auth.logout();
    this.router.navigateByUrl('/giris');
  }

  /** Reloads the user; when verified, moves on to where they were going. */
  private async isDone(): Promise<boolean> {
    try {
      if (!(await this.auth.refreshVerification())) return false;
    } catch {
      return false;
    }
    const back = this.route.snapshot.queryParamMap.get('donus');
    const safe = back && back.startsWith('/') && !back.startsWith('//') ? back : null;
    this.router.navigateByUrl(safe ?? (await this.auth.homeUrl()));
    return true;
  }
}
