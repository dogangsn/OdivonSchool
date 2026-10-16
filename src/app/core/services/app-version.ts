import { Injectable, inject, signal } from '@angular/core';
import { Auth, signOut } from '@angular/fire/auth';
import { APP_VERSION, BUILD_ID } from '../../../environments/build-version';

/** Tarayıcıda en son çalışan build kimliğinin tutulduğu anahtar. */
export const APP_VERSION_STORAGE_KEY = 'odivon_app_version';
/** Sürüm temizliğinde silinmeyen anahtarlar (misafir test kotası kötüye kullanılmasın diye). */
const PRESERVED_KEYS = ['odivon_guest_tests_v1'];
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

export interface RemoteVersion {
  version: string;
  build: string;
}

/** Yeni sürüme geçişte yapılan temizliğin özeti (bilgilendirme modalı için). */
export interface UpdateApplied {
  version: string;
  loggedOut: boolean;
}

/**
 * Sürüm kontrolü.
 * - Çalışırken: /version.json periyodik olarak ve sekme öne geldiğinde okunur; sunucuda
 *   yeni bir sürüm varsa `available` dolar ve "Yeni sürüm yayınlandı" modalı gösterilir.
 *   Kullanıcı güncelle dediğinde sayfa yenilenir ve yeni paket yüklenir.
 * - Açılışta: tarayıcıda kayıtlı build, bu paketin build'inden farklıysa yeni sürüme
 *   geçilmiş demektir; giriş yapmış kullanıcı çıkarılır, çerezler ve yerel depolama temizlenir.
 */
@Injectable({ providedIn: 'root' })
export class AppVersionService {
  private auth = inject(Auth);
  private started = false;
  private dismissedBuild: string | null = null;

  readonly version = APP_VERSION;
  readonly build = BUILD_ID;
  /** Sunucuda bekleyen yeni sürüm (modal açık). */
  readonly available = signal<RemoteVersion | null>(null);
  /** Bu açılışta yeni sürüme geçildiyse doludur. */
  readonly applied = signal<UpdateApplied | null>(null);

  /** Uygulama başlamadan önce çalışır (provideAppInitializer). */
  async init(): Promise<void> {
    if (typeof window === 'undefined' || BUILD_ID === 'dev') return;

    const stored = readStorage(localStorage, APP_VERSION_STORAGE_KEY);
    if (stored && stored !== BUILD_ID) {
      const loggedOut = await this.resetClientState();
      this.applied.set({ version: APP_VERSION, loggedOut });
    }
    writeStorage(localStorage, APP_VERSION_STORAGE_KEY, BUILD_ID);
    this.startPolling();
  }

  /** Sunucudaki sürümü okur; farklıysa modalı açar. */
  async checkForUpdate(): Promise<boolean> {
    const remote = await this.fetchRemoteVersion();
    if (!remote || remote.build === BUILD_ID) return false;
    if (remote.build !== this.dismissedBuild) this.available.set(remote);
    return true;
  }

  /** "Şimdi güncelle": yeni paketi yükler; temizlik yeni paket açılırken yapılır. */
  applyUpdate() {
    window.location.reload();
  }

  /** "Daha sonra": bu sürüm için modal bir sonraki sayfa açılışına kadar gösterilmez. */
  postpone() {
    this.dismissedBuild = this.available()?.build ?? null;
    this.available.set(null);
  }

  dismissApplied() {
    this.applied.set(null);
  }

  private startPolling() {
    if (this.started) return;
    this.started = true;
    setInterval(() => void this.checkForUpdate(), CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.checkForUpdate();
    });
    void this.checkForUpdate();
  }

  private async fetchRemoteVersion(): Promise<RemoteVersion | null> {
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return null;
      const body = (await res.json()) as { version?: unknown; build?: unknown };
      const build = typeof body.build === 'string' && body.build ? body.build : null;
      if (!build) return null;
      return { version: typeof body.version === 'string' ? body.version : '', build };
    } catch {
      return null;
    }
  }

  /** Yeni sürüme geçişte: oturumu kapat, çerezleri ve depolamayı temizle. */
  private async resetClientState(): Promise<boolean> {
    let loggedOut = false;
    try {
      await this.auth.authStateReady();
      if (this.auth.currentUser) {
        await signOut(this.auth);
        loggedOut = true;
      }
    } catch {}

    const preserved = PRESERVED_KEYS.map((k) => [k, readStorage(localStorage, k)] as const);
    try {
      localStorage.clear();
    } catch {}
    for (const [k, v] of preserved) if (v !== null) writeStorage(localStorage, k, v);
    try {
      sessionStorage.clear();
    } catch {}

    clearCookies();

    // Uygulamanın kendi Cache Storage kayıtları (bildirim service worker'ına dokunulmaz).
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {}
    return loggedOut;
  }
}

function clearCookies() {
  const host = window.location.hostname;
  const domains = ['', host, `.${host}`];
  const parts = host.split('.');
  if (parts.length > 2) domains.push(`.${parts.slice(-2).join('.')}`);
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0].trim();
    if (!name) continue;
    for (const d of domains) {
      const domain = d ? `; domain=${d}` : '';
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`;
    }
  }
}

function readStorage(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value);
  } catch {}
}
