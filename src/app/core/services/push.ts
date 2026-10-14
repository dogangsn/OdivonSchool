import { Injectable, NgZone, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { FirebaseApp } from '@angular/fire/app';
import { Firestore, deleteDoc, doc, setDoc, updateDoc } from '@angular/fire/firestore';
import type { Messaging } from 'firebase/messaging';
import { AuthService } from './auth';
import { environment } from '../../../environments/environment';

/**
 * - unsupported: this browser can't receive web push (e.g. iOS Safari outside a home-screen app)
 * - unconfigured: no VAPID key in the environment yet (functions/README.md)
 * - denied: the user blocked notifications for this site in the browser
 * - off / on: the switch on the profile page
 */
export type PushStatus = 'checking' | 'unsupported' | 'unconfigured' | 'denied' | 'off' | 'on';

const SW_URL = '/firebase-messaging-sw.js';
/** Firebase's default push scope: keeps this worker apart from any app-wide service worker. */
const SW_SCOPE = '/firebase-cloud-messaging-push-scope';
const STORAGE_PREFIX = 'odivon.push.';

/** Stable document id for a token: hex SHA-256, so the same browser never gets two docs. */
export async function tokenDocId(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
}

function readStore(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStore(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* private mode etc. */
  }
}

/**
 * Opt-in browser notifications (Firebase Cloud Messaging). The token of this
 * browser is stored in users/{uid}/fcmTokens/{sha256(token)}; the daily
 * digest function (functions/src/digest.ts) sends at most one message a day.
 */
@Injectable({ providedIn: 'root' })
export class PushService {
  private app = inject(FirebaseApp);
  private firestore = inject(Firestore);
  private auth = inject(AuthService);
  private router = inject(Router);
  private zone = inject(NgZone);

  private readonly user = toSignal(this.auth.appUser$, { initialValue: null });
  private readonly isSupported = signal<boolean | null>(null);
  private readonly permission = signal<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  /** Bumped when this browser's saved token changes (localStorage isn't reactive). */
  private readonly tokenVersion = signal(0);

  private messaging: Messaging | null = null;
  private foregroundStarted = false;
  private initStarted = false;

  readonly configured = !!environment.vapidKey;
  readonly busy = signal(false);

  readonly status = computed<PushStatus>(() => {
    if (!this.configured) return 'unconfigured';
    const supported = this.isSupported();
    if (supported === null) return 'checking';
    if (!supported) return 'unsupported';
    if (this.permission() === 'denied') return 'denied';
    return this.enabled() ? 'on' : 'off';
  });

  constructor() {
    // Without a VAPID key nothing is loaded at all (firebase/messaging is a lazy chunk).
    if (this.configured) void this.checkSupport();
  }

  supported(): boolean {
    return this.isSupported() === true;
  }

  /** True when this browser is registered and the user hasn't turned push off. */
  enabled(): boolean {
    this.tokenVersion();
    const user = this.user();
    return (
      !!user &&
      this.supported() &&
      this.configured &&
      this.permission() === 'granted' &&
      user.notifyPush !== false &&
      !!readStore(STORAGE_PREFIX + user.uid)
    );
  }

  /**
   * Called once at start-up (app.config.ts). Does nothing unless push is
   * configured and supported; never blocks rendering.
   */
  init(): void {
    if (this.initStarted || typeof window === 'undefined') return;
    this.initStarted = true;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
        const data = event.data as { type?: string; link?: string } | null;
        if (data?.type === 'odivon-push-open' && typeof data.link === 'string' && data.link.startsWith('/')) {
          this.zone.run(() => this.router.navigateByUrl(data.link!));
        }
      });
    }
    let refreshed: string | null = null;
    this.auth.appUser$.subscribe((user) => {
      // Once per signed-in user and page load (the user doc emits on every XP change).
      if (!user || !this.configured || refreshed === user.uid || user.notifyPush === false) return;
      refreshed = user.uid;
      void this.refresh(user.uid);
    });
  }

  async enable(): Promise<void> {
    const user = this.user();
    if (!user) throw new Error('Önce giriş yapmalısınız.');
    if (!this.configured) throw new Error('Tarayıcı bildirimleri henüz yapılandırılmadı.');
    if (!(await this.checkSupport())) throw new Error('Bu tarayıcı bildirimleri desteklemiyor.');

    this.busy.set(true);
    try {
      const permission = await Notification.requestPermission();
      this.permission.set(permission);
      if (permission !== 'granted') {
        throw new Error(
          permission === 'denied'
            ? 'Bildirim izni engellendi. Tarayıcının adres çubuğundaki site ayarlarından izin verebilirsiniz.'
            : 'Bildirim izni verilmedi.'
        );
      }
      await this.saveToken(user.uid);
      if (user.notifyPush === false) {
        await updateDoc(doc(this.firestore, `users/${user.uid}`), { notifyPush: true });
      }
      await this.startForeground();
    } finally {
      this.busy.set(false);
    }
  }

  async disable(): Promise<void> {
    const user = this.user();
    if (!user) return;
    this.busy.set(true);
    try {
      const key = STORAGE_PREFIX + user.uid;
      const tokenId = readStore(key);
      if (tokenId) await deleteDoc(doc(this.firestore, `users/${user.uid}/fcmTokens/${tokenId}`));
      writeStore(key, null);
      this.tokenVersion.update((v) => v + 1);
      if (user.notifyPush !== false) {
        await updateDoc(doc(this.firestore, `users/${user.uid}`), { notifyPush: false });
      }
      const messaging = await this.getMessagingInstance().catch(() => null);
      if (messaging) {
        const { deleteToken } = await import('firebase/messaging');
        await deleteToken(messaging).catch(() => undefined);
      }
    } finally {
      this.busy.set(false);
    }
  }

  // -------------------------------------------------------------------------

  private async checkSupport(): Promise<boolean> {
    if (this.isSupported() !== null) return this.isSupported()!;
    let ok = false;
    try {
      if (
        typeof window !== 'undefined' &&
        typeof Notification !== 'undefined' &&
        'serviceWorker' in navigator &&
        typeof crypto !== 'undefined' &&
        !!crypto.subtle
      ) {
        const { isSupported } = await import('firebase/messaging');
        ok = await isSupported();
      }
    } catch {
      ok = false;
    }
    this.isSupported.set(ok);
    return ok;
  }

  private async getMessagingInstance(): Promise<Messaging> {
    if (!this.messaging) {
      const { getMessaging } = await import('firebase/messaging');
      this.messaging = getMessaging(this.app);
    }
    return this.messaging;
  }

  private async registration(): Promise<ServiceWorkerRegistration> {
    const url = `${SW_URL}?config=${encodeURIComponent(JSON.stringify(environment.firebase))}`;
    const reg = await navigator.serviceWorker.register(url, { scope: SW_SCOPE });
    const worker = reg.installing ?? reg.waiting;
    if (!reg.active && worker) {
      await new Promise<void>((resolve) => {
        const done = () => worker.state === 'activated' && resolve();
        worker.addEventListener('statechange', done);
        done();
      });
    }
    return reg;
  }

  /** Gets this browser's FCM token and stores it; replaces a rotated one. */
  private async saveToken(uid: string): Promise<void> {
    const { getToken } = await import('firebase/messaging');
    const reg = await this.registration();
    const messaging = await this.getMessagingInstance();
    const token = await getToken(messaging, { vapidKey: environment.vapidKey, serviceWorkerRegistration: reg });
    if (!token) throw new Error('Bildirim anahtarı alınamadı. Lütfen tekrar deneyin.');

    const key = STORAGE_PREFIX + uid;
    const tokenId = await tokenDocId(token);
    const previous = readStore(key);
    await setDoc(doc(this.firestore, `users/${uid}/fcmTokens/${tokenId}`), {
      token,
      createdAt: Date.now(),
      userAgent: navigator.userAgent.slice(0, 300),
    });
    if (previous && previous !== tokenId) {
      await deleteDoc(doc(this.firestore, `users/${uid}/fcmTokens/${previous}`)).catch(() => undefined);
    }
    writeStore(key, tokenId);
    this.tokenVersion.update((v) => v + 1);
  }

  /** On start-up: if this browser was registered, keep the token fresh and listen in the foreground. */
  private async refresh(uid: string): Promise<void> {
    try {
      if (!readStore(STORAGE_PREFIX + uid)) return;
      if (!(await this.checkSupport())) return;
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      await this.saveToken(uid);
      await this.startForeground();
    } catch (err) {
      console.warn('Push token refresh failed', err);
    }
  }

  /** While the app is open FCM doesn't show anything itself: show the same notification. */
  private async startForeground(): Promise<void> {
    if (this.foregroundStarted) return;
    this.foregroundStarted = true;
    const { onMessage } = await import('firebase/messaging');
    const messaging = await this.getMessagingInstance();
    onMessage(messaging, async (payload) => {
      const data = { ...(payload.data ?? {}) } as Record<string, string>;
      const title = payload.notification?.title ?? data['title'] ?? 'Odivon School';
      const body = payload.notification?.body ?? data['body'] ?? '';
      const link = data['link'] ?? '/';
      try {
        const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
        if (reg) {
          await reg.showNotification(title, {
            body,
            icon: '/logo.png',
            tag: data['tag'] ?? 'odivon',
            data: { link },
          });
          return;
        }
      } catch {
        /* fall through */
      }
      new Notification(title, { body, icon: '/logo.png' });
    });
  }
}
