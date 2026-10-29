import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Header + tabs shared by every /yonetim page. */
@Component({
  selector: 'app-admin-nav',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <div class="admin-head">
      <div class="head-left">
        <span class="admin-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>
          Yönetici Paneli
        </span>
        <h1>{{ title() }}</h1>
        @if (subtitle()) {
          <p>{{ subtitle() }}</p>
        }
      </div>
      <nav class="admin-tabs" aria-label="Yönetim bölümleri">
        <a routerLink="/yonetim/genel-bakis" routerLinkActive="active">Genel Bakış</a>
        <a routerLink="/yonetim/aboneler" routerLinkActive="active">Kullanıcılar &amp; Abonelik</a>
        <a routerLink="/yonetim/havuz" routerLinkActive="active">Soru Havuzu</a>
        <a routerLink="/yonetim/sorular" routerLinkActive="active">Üretim &amp; Onay</a>
      </nav>
    </div>
  `,
  styles: `
    :host { display: block; }
    .admin-head {
      display: flex; align-items: flex-end; justify-content: space-between;
      flex-wrap: wrap; gap: 16px; border-bottom: 1px solid var(--border); padding-bottom: 20px;
    }
    .head-left { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .admin-badge {
      align-self: flex-start; display: inline-flex; align-items: center; gap: 6px;
      background: var(--accent-light); color: var(--accent); font-size: 0.8rem; font-weight: 700;
      padding: 4px 12px; border-radius: var(--radius-full);
    }
    h1 { font-size: clamp(1.5rem, 4vw, 2.1rem); font-weight: 800; }
    p { font-size: 0.95rem; color: var(--text-muted); }
    .admin-tabs {
      display: flex; gap: 6px; background: var(--bg-alt); padding: 4px;
      border-radius: var(--radius-sm); border: 1px solid var(--border); overflow-x: auto; max-width: 100%;
    }
    .admin-tabs a {
      padding: 8px 14px; font-size: 0.88rem; font-weight: 600; color: var(--text-muted);
      border-radius: var(--radius-xs); white-space: nowrap; transition: all var(--transition-fast);
    }
    .admin-tabs a:hover { color: var(--text-main); }
    .admin-tabs a.active {
      background: var(--surface); color: var(--primary); font-weight: 700; box-shadow: var(--shadow-xs);
    }
  `,
})
export class AdminNav {
  title = input.required<string>();
  subtitle = input<string>('');
}
