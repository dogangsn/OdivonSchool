import { Component, inject, computed, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FirestoreService } from '../../../core/services/firestore';

@Component({
  selector: 'app-subscriber-detail',
  imports: [RouterLink, DatePipe],
  templateUrl: './subscriber-detail.html',
  styleUrl: './subscriber-detail.scss',
})
export class SubscriberDetail {
  private route = inject(ActivatedRoute);
  private firestoreSvc = inject(FirestoreService);

  userId = this.route.snapshot.paramMap.get('userId')!;

  user = toSignal(this.firestoreSvc.userById(this.userId), { initialValue: null });
  attempts = toSignal(this.firestoreSvc.allAttempts(), { initialValue: [] });

  userAttempts = computed(() => this.attempts().filter((a) => a.userId === this.userId));

  successRate = computed(() => {
    const list = this.userAttempts();
    if (!list.length) return 0;
    const totalCorrect = list.reduce((sum, a) => sum + a.correctCount, 0);
    const totalQuestions = list.reduce((sum, a) => sum + a.totalCount, 0);
    return totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  });

  isUpdating = signal(false);
  actionMessage = signal<{ type: 'success' | 'danger'; text: string } | null>(null);

  async toggleRole() {
    const u = this.user();
    if (!u) return;

    const newRole = u.role === 'admin' ? 'user' : 'admin';
    const confirmMsg =
      newRole === 'admin'
        ? `Bu kullanıcıya (${u.email}) Yönetici (Admin) yetkisi vermek istediğinize emin misiniz?`
        : `Bu kullanıcının (${u.email}) Yönetici yetkisini kaldırmak istediğinize emin misiniz?`;

    if (!confirm(confirmMsg)) return;

    this.isUpdating.set(true);
    this.actionMessage.set(null);
    try {
      await this.firestoreSvc.updateUserRole(this.userId, newRole);
      this.actionMessage.set({
        type: 'success',
        text: `Kullanıcı rolü başarıyla "${newRole === 'admin' ? 'Yönetici' : 'Öğrenci'}" olarak güncellendi.`,
      });
    } catch (err: any) {
      this.actionMessage.set({
        type: 'danger',
        text: `Hata oluştu: ${err?.message || 'Rol güncellenemedi.'}`,
      });
    } finally {
      this.isUpdating.set(false);
    }
  }

  async setSubscription(status: 'active' | 'none' | 'trial' | 'expired') {
    const u = this.user();
    if (!u) return;

    this.isUpdating.set(true);
    this.actionMessage.set(null);
    try {
      await this.firestoreSvc.updateUserSubscription(this.userId, status);
      const statusLabels: Record<string, string> = {
        active: 'Aktif Pro Abone',
        trial: 'Deneme Sürümü',
        expired: 'Süresi Doldu',
        none: 'Abonelik Yok (Ücretsiz)',
      };
      this.actionMessage.set({
        type: 'success',
        text: `Abonelik durumu başarıyla "${statusLabels[status]}" olarak güncellendi.`,
      });
    } catch (err: any) {
      this.actionMessage.set({
        type: 'danger',
        text: `Hata oluştu: ${err?.message || 'Abonelik durumu güncellenemedi.'}`,
      });
    } finally {
      this.isUpdating.set(false);
    }
  }
}
