import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { GuestQuotaService } from '../../../core/services/guest-quota';
import { EducationLevel, SIGNUP_GRADES, levelForGrade } from '../../../models/test-category';
import { SignupProfile, SignupRole } from '../../../models/user';
import { getAuthErrorMessage } from '../../../core/utils/auth-error';


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

  readonly gradeChoices = SIGNUP_GRADES;
  readonly levelGroups: { level: EducationLevel; title: string; icon: string }[] = [
    { level: 'ilkokul', title: 'İlkokul', icon: '🌱' },
    { level: 'ortaokul', title: 'Ortaokul', icon: '🎒' },
    { level: 'lise', title: 'Lise', icon: '🏛️' },
    { level: 'kpss', title: 'KPSS', icon: '💼' },
  ];

  email = '';
  password = '';
  displayName = '';
  school = '';
  branch = '';

  role = signal<SignupRole>('student');
  /** Selected sınıf (0 = KPSS); null until the student picks one. */
  grade = signal<number | null>(null);
  errorMessage = signal<string | null>(null);
  loading = signal(false);

  gradesOf(level: EducationLevel) {
    return this.gradeChoices.filter((g) => g.level === level);
  }

  /** Students must pick a sınıf; teachers don't. */
  profileComplete = computed(() => this.role() === 'teacher' || this.grade() !== null);

  selectRole(role: SignupRole) {
    this.role.set(role);
    this.errorMessage.set(null);
  }

  selectGrade(grade: number) {
    this.grade.set(grade);
  }

  private buildProfile(): SignupProfile {
    if (this.role() === 'teacher') {
      return {
        role: 'teacher',
        gradeLevel: 'ilkokul',
        grade: null,
        school: this.school,
        branch: this.branch,
      };
    }
    const grade = this.grade() ?? 0;
    return {
      role: 'student',
      gradeLevel: grade === 0 ? 'kpss' : levelForGrade(grade),
      grade: grade === 0 ? null : grade,
    };
  }

  private requireGrade(): boolean {
    if (this.profileComplete()) return true;
    this.errorMessage.set('Lütfen sınıfını seç; sana uygun soru ve oyunları buna göre hazırlayacağız.');
    return false;
  }

  async submit() {
    this.errorMessage.set(null);
    if (!this.requireGrade()) return;
    this.loading.set(true);
    try {
      await this.auth.register(this.email, this.password, this.displayName, this.buildProfile());
      // Clean slate - ensure new registered user starts with 0 data
      this.guestQuota.clearGuestData();
      this.router.navigateByUrl('/eposta-dogrula');
    } catch (err: any) {
      console.error('[Register] submit error:', err);
      this.errorMessage.set(getAuthErrorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }
}
