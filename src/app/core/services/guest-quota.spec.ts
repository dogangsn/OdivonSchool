import { TestBed } from '@angular/core/testing';
import { GuestQuotaService, MAX_GUEST_TESTS } from './guest-quota';

describe('GuestQuotaService', () => {
  beforeEach(() => {
    localStorage.removeItem('odivon_guest_tests_v1');
    TestBed.configureTestingModule({});
  });

  it('blocks after the free guest quota is used', () => {
    const quota = TestBed.inject(GuestQuotaService);
    expect(quota.canSolve()).toBeTrue();
    for (let i = 0; i < MAX_GUEST_TESTS; i++) {
      quota.recordGuestAttempt({
        userId: 'guest',
        categoryId: `cat-${i}`,
        level: 'ilkokul',
        subject: 'Matematik',
        startedAt: 0,
        answers: [],
        correctCount: 0,
        totalCount: 0,
        successRate: 0,
      });
    }
    expect(quota.canSolve()).toBeFalse();
    expect(quota.remainingCount()).toBe(0);
  });
});
