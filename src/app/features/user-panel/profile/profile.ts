import { Component, inject, signal, effect, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/services/auth';
import { FirestoreService } from '../../../core/services/firestore';
import { PushService } from '../../../core/services/push';
import { STUDENT_EMAIL_DOMAIN } from '../../../core/student-accounts';
import { Firestore, doc, updateDoc } from '@angular/fire/firestore';
import { LEVEL_GRADES } from '../../../models/test-category';
import { isStudent, roleLabel } from '../../../models/user';
import { PLANS, effectivePlan, effectiveStatus } from '../../../models/subscription';

@Component({
  selector: 'app-profile',
  imports: [FormsModule, RouterLink, DatePipe],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile {
  readonly roleLabel = roleLabel;
  private auth = inject(AuthService);
  private firestoreSvc = inject(FirestoreService);

  appUser = toSignal(this.auth.appUser$, { initialValue: null });

  /** Plan the user can use right now (an end date in the past counts as expired). */
  subStatus = computed(() => effectiveStatus(this.appUser()));
  planLabel = computed(() => PLANS[effectivePlan(this.appUser())].label);

  displayName = signal('');
  gradeLevel = signal<'ilkokul' | 'ortaokul' | 'lise' | 'kpss'>('ortaokul');
  grade = signal<number | null>(null);
  gradeOptions = computed(() => LEVEL_GRADES[this.gradeLevel()]);

  isSaving = signal(false);
  saveMessage = signal<{ type: 'success' | 'danger'; text: string } | null>(null);

  isResettingPassword = signal(false);
  resetMessage = signal<{ type: 'success' | 'danger'; text: string } | null>(null);

  // Bildirim ayarları
  readonly push = inject(PushService);
  private firestore = inject(Firestore);
  isStudentUser = computed(() => isStudent(this.appUser()));
  /** Teacher-opened student accounts sign in with a username: no inbox to write to. */
  hasRealEmail = computed(() => {
    const user = this.appUser();
    const email = (user?.email || '').toLowerCase();
    return !!email && !user?.createdByTeacher && !email.endsWith('@' + STUDENT_EMAIL_DOMAIN);
  });
  emailOn = computed(() => this.appUser()?.notifyEmail !== false);
  isSavingEmail = signal(false);
  notifyMessage = signal<{ type: 'success' | 'danger'; text: string } | null>(null);

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

  async togglePush(event?: Event) {
    const input = event?.target as HTMLInputElement | undefined;
    this.notifyMessage.set(null);
    try {
      if (this.push.enabled()) {
        await this.push.disable();
        this.notifyMessage.set({ type: 'success', text: 'Tarayıcı bildirimleri kapatıldı.' });
      } else {
        await this.push.enable();
        this.notifyMessage.set({
          type: 'success',
          text: this.isStudentUser()
            ? 'Bildirimler açıldı. Yeni bir şey olduğunda günde en fazla bir özet alacaksın.'
            : 'Bildirimler açıldı. Sınıflarınızla ilgili günlük kısa özet bu tarayıcıya gelecek.',
        });
      }
    } catch (err: any) {
      this.notifyMessage.set({ type: 'danger', text: err?.message || 'Bildirim ayarı değiştirilemedi.' });
    } finally {
      // Keep the switch in line with the real state (e.g. permission refused).
      if (input) input.checked = this.push.enabled();
    }
  }

  async toggleEmail(event?: Event) {
    const input = event?.target as HTMLInputElement | undefined;
    const user = this.appUser();
    if (!user || this.isSavingEmail()) return;
    const next = !this.emailOn();
    this.isSavingEmail.set(true);
    this.notifyMessage.set(null);
    try {
      await updateDoc(doc(this.firestore, `users/${user.uid}`), { notifyEmail: next });
      this.notifyMessage.set({
        type: 'success',
        text: next ? 'Haftalık e-posta özetleri açıldı.' : 'Haftalık e-posta özetleri kapatıldı.',
      });
    } catch (err: any) {
      this.notifyMessage.set({ type: 'danger', text: `Hata: ${err?.message || 'Ayar kaydedilemedi.'}` });
    } finally {
      this.isSavingEmail.set(false);
      if (input) input.checked = this.emailOn();
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
