import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { FirebaseApp } from '@angular/fire/app';
import { Firestore } from '@angular/fire/firestore';
import { of } from 'rxjs';
import { AuthService } from './auth';
import { PushService, tokenDocId } from './push';
import { environment } from '../../../environments/environment';

describe('tokenDocId', () => {
  it('is a stable 40-char hex id per token', async () => {
    const a = await tokenDocId('token-a');
    expect(a).toMatch(/^[0-9a-f]{40}$/);
    expect(await tokenDocId('token-a')).toBe(a);
    expect(await tokenDocId('token-b')).not.toBe(a);
  });
});

describe('PushService without a VAPID key', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: FirebaseApp, useValue: {} },
        { provide: Firestore, useValue: {} },
        { provide: Router, useValue: { navigateByUrl: () => Promise.resolve(true) } },
        { provide: AuthService, useValue: { appUser$: of(null) } },
      ],
    });
  });

  it('reports "unconfigured" and stays off', () => {
    if (environment.vapidKey) return; // the key has been filled in: nothing to check here
    const push = TestBed.inject(PushService);
    expect(push.configured).toBeFalse();
    expect(push.status()).toBe('unconfigured');
    expect(push.enabled()).toBeFalse();
  });

  it('refuses to enable', async () => {
    if (environment.vapidKey) return;
    const push = TestBed.inject(PushService);
    await expectAsync(push.enable()).toBeRejected();
  });
});
