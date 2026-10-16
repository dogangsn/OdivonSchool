import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AppVersionService } from '../../../core/services/app-version';

/** "Yeni sürüm yayınlandı" ve "Uygulama güncellendi" bildirimleri. */
@Component({
  selector: 'app-update-modal',
  template: `
    @if (versions.available(); as remote) {
      <div class="um-backdrop" role="dialog" aria-modal="true" aria-labelledby="um-title">
        <div class="um-card">
          <div class="um-icon" aria-hidden="true">🚀</div>
          <h2 id="um-title">Yeni sürüm yayınlandı</h2>
          <p class="um-version">
            v{{ versions.version }} → <strong>v{{ remote.version }}</strong>
          </p>
          <p>
            Güncelleme ile tarayıcıdaki çerezler ve kayıtlı veriler temizlenecek, giriş yaptıysanız
            oturumunuz kapatılacak. Yarım kalan işinizi kaydettikten sonra güncelleyin.
          </p>
          <div class="um-actions">
            <button class="btn outline" type="button" (click)="versions.postpone()">Daha sonra</button>
            <button class="btn primary" type="button" (click)="versions.applyUpdate()">Şimdi güncelle</button>
          </div>
        </div>
      </div>
    } @else if (versions.applied(); as applied) {
      <div class="um-backdrop" role="dialog" aria-modal="true" aria-labelledby="um-done-title">
        <div class="um-card">
          <div class="um-icon" aria-hidden="true">✅</div>
          <h2 id="um-done-title">Uygulama güncellendi</h2>
          <p class="um-version"><strong>v{{ applied.version }}</strong></p>
          <p>
            Çerezler ve kayıtlı veriler temizlendi.
            @if (applied.loggedOut) {
              Güvenliğiniz için oturumunuz kapatıldı, lütfen tekrar giriş yapın.
            }
          </p>
          <div class="um-actions">
            @if (applied.loggedOut) {
              <button class="btn primary" type="button" (click)="goLogin()">Giriş yap</button>
            } @else {
              <button class="btn primary" type="button" (click)="versions.dismissApplied()">Tamam</button>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .um-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: rgba(15, 23, 42, 0.55);
    }
    .um-card {
      width: 100%;
      max-width: 420px;
      padding: 28px 24px 22px;
      text-align: center;
      background: var(--surface);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
    }
    .um-icon {
      font-size: 40px;
      line-height: 1;
      margin-bottom: 10px;
    }
    h2 {
      margin: 0 0 6px;
      font-size: 1.3rem;
    }
    .um-version {
      margin: 0 0 12px;
      color: var(--primary);
    }
    p {
      margin: 0 0 18px;
      color: var(--text-muted);
      line-height: 1.5;
    }
    .um-actions {
      display: flex;
      gap: 10px;
      justify-content: center;
      flex-wrap: wrap;
    }
  `,
})
export class UpdateModal {
  versions = inject(AppVersionService);
  private router = inject(Router);

  goLogin() {
    this.versions.dismissApplied();
    this.router.navigate(['/giris']);
  }
}
