import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { GuestQuotaService } from '../../../core/services/guest-quota';
import { EducationLevel } from '../../../models/test-category';

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  private auth = inject(AuthService);
  private router = inject(Router);
  private guestQuota = inject(GuestQuotaService);

  email = '';
  password = '';
  displayName = '';
  gradeLevel = signal<EducationLevel>('ortaokul');
  errorMessage = signal<string | null>(null);
  loading = signal(false);

  selectGrade(level: EducationLevel) {
    this.gradeLevel.set(level);
  }

  async submit() {
    this.errorMessage.set(null);
    this.loading.set(true);
    try {
      await this.auth.register(this.email, this.password, this.displayName, this.gradeLevel());
      // Clean slate - ensure new registered user starts with 0 data
      this.guestQuota.clearGuestData();
      this.router.navigateByUrl('/panel');
    } catch (err) {
      this.errorMessage.set('Kayıt başarısız. Bilgilerinizi kontrol edin.');
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
        this.errorMessage.set('Google ile kayıt/giriş yapılırken bir sorun oluştu.');
      }
    } finally {
      this.loading.set(false);
    }
  }
}
