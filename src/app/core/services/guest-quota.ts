import { Injectable, signal, computed } from '@angular/core';
import { TestAttempt } from '../../models/test-attempt';

const GUEST_QUOTA_STORAGE_KEY = 'odivon_guest_tests_v1';
export const MAX_GUEST_TESTS = 5;

@Injectable({ providedIn: 'root' })
export class GuestQuotaService {
  private _attempts = signal<TestAttempt[]>(this.loadFromStorage());

  readonly attempts = computed(() => this._attempts());
  readonly solvedCount = computed(() => this._attempts().length);
  readonly remainingCount = computed(() => Math.max(0, MAX_GUEST_TESTS - this.solvedCount()));
  readonly canSolve = computed(() => this.solvedCount() < MAX_GUEST_TESTS);
  readonly isQuotaExceeded = computed(() => this.solvedCount() >= MAX_GUEST_TESTS);

  private loadFromStorage(): TestAttempt[] {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return [];
      const raw = localStorage.getItem(GUEST_QUOTA_STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as TestAttempt[];
    } catch (e) {
      console.warn('LocalStorage error while reading guest quota:', e);
      return [];
    }
  }

  private saveToStorage(attempts: TestAttempt[]): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(GUEST_QUOTA_STORAGE_KEY, JSON.stringify(attempts));
      }
    } catch (e) {
      console.warn('LocalStorage error while saving guest quota:', e);
    }
  }

  recordGuestAttempt(attempt: Omit<TestAttempt, 'id'>): TestAttempt {
    const fullAttempt: TestAttempt = {
      ...attempt,
      id: 'guest_' + Date.now(),
    };
    const updated = [fullAttempt, ...this._attempts()];
    this._attempts.set(updated);
    this.saveToStorage(updated);
    return fullAttempt;
  }

  getLatestAttempt(categoryId?: string): TestAttempt | null {
    const list = this._attempts();
    if (!list.length) return null;
    if (categoryId) {
      return list.find((a) => a.categoryId === categoryId) ?? list[0] ?? null;
    }
    return list[0] ?? null;
  }

  clearGuestData(): void {
    this._attempts.set([]);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(GUEST_QUOTA_STORAGE_KEY);
      }
    } catch (e) {
      console.warn('LocalStorage error while clearing guest quota:', e);
    }
  }
}
