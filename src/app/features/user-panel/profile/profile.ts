import { Component, inject, signal, effect, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/services/auth';
import { FirestoreService } from '../../../core/services/firestore';
import { LEVEL_GRADES } from '../../../models/test-category';

@Component({
  selector: 'app-profile',
  imports: [FormsModule, RouterLink],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile {
  private auth = inject(AuthService);
  private firestoreSvc = inject(FirestoreService);

  appUser = toSignal(this.auth.appUser$, { initialValue: null });

  displayName = signal('');
  gradeLevel = signal<'ilkokul' | 'ortaokul' | 'lise' | 'kpss'>('ortaokul');
  grade = signal<number | null>(null);
  gradeOptions = computed(() => LEVEL_GRADES[this.gradeLevel()]);

  isSaving = signal(false);
  saveMessage = signal<{ type: 'success' | 'danger'; text: string } | null>(null);

  isResettingPassword = signal(false);
  resetMessage = signal<{ type: 'success' | 'danger'; text: string } | null>(null);

  constructor() {
    effect(() => {
      const user = this.appUser();
      if (user) {
        this.displayName.set(user.displayName || '');
        if (user.gradeLevel) {
          this.gradeLevel.set(user.gradeLevel);
        }
        this.grade.set(user.grade ?? null);
      }
    });
  }

  setGradeLevel(level: 'ilkokul' | 'ortaokul' | 'lise' | 'kpss') {
    this.gradeLevel.set(level);
    const g = this.grade();
    if (g !== null && !LEVEL_GRADES[level].includes(g)) this.grade.set(null);
  }

  async saveProfile() {
    const user = this.appUser();
    if (!user) return;

    const trimmedName = this.displayName().trim();
    if (!trimmedName) {
      this.saveMessage.set({ type: 'danger', text: 'Lütfen adınızı ve soyadınızı girin.' });
      return;
    }

    this.isSaving.set(true);
    this.saveMessage.set(null);
    try {
      await this.firestoreSvc.updateUserProfile(user.uid, {
        displayName: trimmedName,
        gradeLevel: this.gradeLevel(),
        grade: this.grade(),
      });
      this.saveMessage.set({ type: 'success', text: 'Profil bilgileriniz başarıyla güncellendi.' });
    } catch (err: any) {
      this.saveMessage.set({
        type: 'danger',
        text: `Hata: ${err?.message || 'Profil güncellenemedi.'}`,
      });
    } finally {
      this.isSaving.set(false);
    }
  }

  async requestPasswordReset() {
    const user = this.appUser();
    if (!user?.email) return;

    this.isResettingPassword.set(true);
    this.resetMessage.set(null);
    try {
      await this.auth.sendPasswordReset(user.email);
      this.resetMessage.set({
        type: 'success',
        text: `Şifre sıfırlama bağlantısı "${user.email}" adresinize gönderildi. Lütfen gelen kutunuzu kontrol edin.`,
      });
    } catch (err: any) {
      this.resetMessage.set({
        type: 'danger',
        text: `Hata: ${err?.message || 'Sıfırlama e-postası gönderilemedi.'}`,
      });
    } finally {
      this.isResettingPassword.set(false);
    }
  }
}
