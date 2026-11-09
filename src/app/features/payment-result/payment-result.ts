import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/services/auth';
import { PLANS, effectivePlan, hasPremium } from '../../models/subscription';

/**
 * PayTR sends the shopper here after the iframe (merchant_ok_url /
 * merchant_fail_url). The real result comes from PayTR's server call to
 * paytrCallback; "basarili" here only means the card step finished, so the
 * page waits for the live user doc to show the active subscription.
 */
@Component({
  selector: 'app-payment-result',
  imports: [RouterLink],
  template: `
    <div class="result container animate-fade-in">
      <div class="card result-card">
        @if (!ok) {
          <div class="emoji">⚠️</div>
          <h1>Ödeme tamamlanamadı</h1>
          <p>Kartından para çekilmedi. Bilgileri kontrol edip tekrar deneyebilirsin.</p>
          <a routerLink="/fiyatlandirma" class="btn primary lg">Tekrar dene</a>
        } @else if (active()) {
          <div class="emoji">🎉</div>
          <h1>Üyeliğin aktif!</h1>
          <p><strong>{{ planLabel() }}</strong> üyeliğin başladı. İyi çalışmalar!</p>
          <a routerLink="/panel/kategoriler" class="btn primary lg">Test çözmeye başla →</a>
        } @else {
          <div class="spinner lg"></div>
          <h1>Ödemen alındı</h1>
          <p>Üyeliğin birkaç saniye içinde açılacak. Bu sayfa kendiliğinden güncellenir.</p>
          <a routerLink="/panel" class="btn outline">Panele dön</a>
        }
      </div>
    </div>
  `,
  styles: `
    .result { padding: 64px 16px; display: flex; justify-content: center; }
    .result-card {
      max-width: 460px; width: 100%; padding: 36px 28px; text-align: center;
      display: flex; flex-direction: column; align-items: center; gap: 14px;
    }
    .emoji { font-size: 3rem; }
    h1 { font-size: 1.5rem; font-weight: 800; }
    p { color: var(--text-muted); }
  `,
})
export class PaymentResult {
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);

  ok = this.route.snapshot.queryParamMap.get('durum') === 'basarili';
  private user = toSignal(this.auth.appUser$, { initialValue: null });
  active = computed(() => hasPremium(this.user()));
  planLabel = computed(() => PLANS[effectivePlan(this.user())].label);

  constructor() {
    // PayTR redirects inside its iframe; show the result on the whole page.
    try {
      if (window.top && window.top !== window.self) window.top.location.href = window.location.href;
    } catch {
      /* cross-origin top: stay in the frame */
    }
  }
}
