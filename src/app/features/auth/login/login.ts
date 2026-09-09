import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private auth = inject(AuthService);
  private router = inject(Router);

  email = '';
  password = '';
  errorMessage = signal<string | null>(null);
  loading = signal(false);

  async submit() {
    this.errorMessage.set(null);
    this.loading.set(true);
    try {
      await this.auth.login(this.email, this.password);
      this.router.navigateByUrl('/panel');
    } catch (err) {
      this.errorMessage.set('Giriş başarısız. E-posta ve şifrenizi kontrol edin.');
    } finally {
      this.loading.set(false);
    }
  }

  async loginWithGoogle() {
    this.errorMessage.set(null);
    this.loading.set(true);
    try {
      await this.auth.loginWithGoogle();
      this.router.navigateByUrl('/panel');
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        this.errorMessage.set('Google ile giriş yapılırken bir sorun oluştu.');
      }
    } finally {
      this.loading.set(false);
    }
  }
}
