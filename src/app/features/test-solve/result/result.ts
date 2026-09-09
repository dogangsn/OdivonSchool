import { Component, inject, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap, of, map } from 'rxjs';
import { AuthService } from '../../../core/services/auth';
import { FirestoreService } from '../../../core/services/firestore';
import { GuestQuotaService } from '../../../core/services/guest-quota';

@Component({
  selector: 'app-result',
  imports: [RouterLink],
  templateUrl: './result.html',
  styleUrl: './result.scss',
})
export class Result {
  private route = inject(ActivatedRoute);
  auth = inject(AuthService);
  guestQuota = inject(GuestQuotaService);
  private firestoreSvc = inject(FirestoreService);

  categoryId = this.route.snapshot.paramMap.get('categoryId')!;
  category = toSignal(this.firestoreSvc.categoryById(this.categoryId), { initialValue: null });
  appUser = toSignal(this.auth.appUser$, { initialValue: null });

  private userLatestAttempt = toSignal(
    this.auth.appUser$.pipe(
      switchMap((appUser) =>
        appUser ? this.firestoreSvc.attemptsForUser(appUser.uid) : of([])
      ),
      map((attempts) => attempts.find((a) => a.categoryId === this.categoryId) ?? null)
    ),
    { initialValue: null }
  );

  latestAttempt = computed(() => {
    const user = this.appUser();
    if (!user) {
      return this.guestQuota.getLatestAttempt(this.categoryId);
    }
    return this.userLatestAttempt();
  });

  wrongCount = computed(() => {
    const a = this.latestAttempt();
    if (!a) return 0;
    return (a.totalCount || 0) - (a.correctCount || 0);
  });

  performanceStatus = computed(() => {
    const rate = this.latestAttempt()?.successRate ?? 0;
    if (rate >= 80) {
      return {
        badge: 'Üstün Başarı 🌟',
        title: 'Mükemmel Sonuç!',
        desc: 'Konuyu son derece iyi kavramışsın. Bu başarı grafiğini koruyarak devam et!',
        color: 'success',
      };
    } else if (rate >= 50) {
      return {
        badge: 'İyi Performans 👍',
        title: 'Tebrikler, Gayet İyi!',
        desc: 'Konunun temel noktalarını biliyorsun. Birkaç pratik ile tam puana ulaşabilirsin.',
        color: 'warning',
      };
    } else {
      return {
        badge: 'Geliştirilmeli 💪',
        title: 'Pratik Yapmaya Devam Et!',
        desc: 'Öğretici açıklamaları inceleyerek eksik kaldığın kısımları hızla toparlayabilirsin.',
        color: 'danger',
      };
    }
  });
}
