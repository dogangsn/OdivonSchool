import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { getAuthErrorMessage } from '../../../core/utils/auth-error';
import { loginIdToEmail } from '../../../core/student-accounts';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  email = '';
  password = '';
  errorMessage = signal<string | null>(null);
  infoMessage = signal<string | null>(null);
  loading = signal(false);

  async submit() {
    this.errorMessage.set(null);
    this.infoMessage.set(null);
    this.loading.set(true);
    try {
      await this.auth.login(loginIdToEmail(this.email), this.password);
      const back = this.returnUrl();
      if (back && this.auth.needsVerification()) {
        this.router.navigate(['/eposta-dogrula'], { queryParams: { donus: back } });
      } else {
        this.router.navigateByUrl(back ?? (await this.auth.homeUrl()));
      }
    } catch (err: any) {
      console.error('[Login] submit error:', err);
      this.errorMessage.set(getAuthErrorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  async forgotPassword() {
    this.errorMessage.set(null);
    this.infoMessage.set(null);
    const id = this.email.trim();
    if (!id.includes('@')) {
      this.errorMessage.set(
        id
          ? 'Kullanıcı adıyla giriş yapan öğrencilerin şifresini öğretmeni yenileyebilir.'
          : 'Şifre sıfırlama bağlantısı için önce e-posta adresini yaz.'
      );
      return;
    }
    this.loading.set(true);
    try {
      await this.auth.sendPasswordReset(id);
      this.infoMessage.set(`${id} adresine şifre belirleme bağlantısı gönderdik. Gelen kutunu (ve spam klasörünü) kontrol et.`);
    } catch (err: any) {
      console.error('[Login] forgotPassword error:', err);
      this.errorMessage.set(getAuthErrorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  /** Where the auth guard sent us from (e.g. a düello link), internal paths only. */
  private returnUrl(): string | null {
    const url = this.route.snapshot.queryParamMap.get('donus');
    return url && url.startsWith('/') && !url.startsWith('//') ? url : null;
  }
}
