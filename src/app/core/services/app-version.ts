import { Injectable, inject } from '@angular/core';
import { Auth, signOut } from '@angular/fire/auth';
import { BUILD_VERSION } from '../../../environments/build-version';

/** Tarayıcıda en son çalışan sürümün tutulduğu anahtar. */
export const APP_VERSION_STORAGE_KEY = 'odivon_app_version';
/** Sürüm temizliğinde silinmeyen anahtarlar (misafir test kotası kötüye kullanılmasın diye). */
const PRESERVED_KEYS = ['odivon_guest_tests_v1'];
/** Aynı yeni sürüm için sayfayı en fazla bir kez yenilemek için. */
const RELOADED_FOR_KEY = 'odivon_reloaded_for_version';
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Yeni sürüm kontrolü.
 * - Açılışta: tarayıcıda kayıtlı sürüm, bu paketin sürümünden farklıysa yeni sürüme
 *   geçilmiş demektir; çerezler ve yerel depolama temizlenir, giriş yapmış kullanıcı çıkarılır.
 * - Çalışırken: /version.json periyodik olarak ve sekme öne geldiğinde okunur; sunucuda
 *   daha yeni bir sürüm varsa sayfa yenilenir, böylece yeni paket yüklenip temizlik yapılır.
 */
@Injectable({ providedIn: 'root' })
export class AppVersionService {
  private auth = inject(Auth);
  private started = false;

  readonly version = BUILD_VERSION;

  /** Uygulama başlamadan önce çalışır (provideAppInitializer). */
  async init(): Promise<void> {
    if (typeof window === 'undefined' || BUILD_VERSION === 'dev') return;

    const stored = readStorage(localStorage, APP_VERSION_STORAGE_KEY);
    if (stored && stored !== BUILD_VERSION) {
      await this.resetClientState();
    }
    writeStorage(localStorage, APP_VERSION_STORAGE_KEY, BUILD_VERSION);
    this.startPolling();
  }

  /** Sunucudaki sürümü okur; farklıysa sayfayı yeniler. */
  async checkForUpdate(): Promise<boolean> {
    const remote = await this.fetchRemoteVersion();
    if (!remote || remote === BUILD_VERSION) return false;

    // Önbellekteki eski index.html yüzünden yenileme döngüsüne girmemek için
    // her yeni sürüm için yalnızca bir kez yenile.
    if (readStorage(sessionStorage, RELOADED_FOR_KEY) === remote) return true;
    writeStorage(sessionStorage, RELOADED_FOR_KEY, remote);
    window.location.reload();
    return true;
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

  private async fetchRemoteVersion(): Promise<string | null> {
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return null;
      const body = (await res.json()) as { version?: unknown };
      return typeof body.version === 'string' && body.version ? body.version : null;
    } catch {
      return null;
    }
  }

  /** Yeni sürüme geçişte: oturumu kapat, çerezleri ve depolamayı temizle. */
  private async resetClientState() {
    try {
      await signOut(this.auth);
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
