import { Component, inject, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap, of } from 'rxjs';
import { AuthService } from '../../../core/services/auth';
import { FirestoreService } from '../../../core/services/firestore';

@Component({
  selector: 'app-test-history',
  imports: [DatePipe, RouterLink],
  templateUrl: './test-history.html',
  styleUrl: './test-history.scss',
})
export class TestHistory {
  private auth = inject(AuthService);
  private firestoreSvc = inject(FirestoreService);

  search = signal('');

  attempts = toSignal(
    this.auth.appUser$.pipe(
      switchMap((appUser) => (appUser ? this.firestoreSvc.attemptsForUser(appUser.uid) : of([])))
    ),
    { initialValue: [] }
  );

  filteredAttempts = computed(() => {
    const term = this.search().toLowerCase().trim();
    const list = this.attempts();
    if (!term) return list;
    return list.filter(
      (a) =>
        a.subject?.toLowerCase().includes(term) ||
        a.level?.toLowerCase().includes(term)
    );
  });

  totalCount = computed(() => this.attempts().length);

  averageRate = computed(() => {
    const list = this.attempts();
    if (!list.length) return 0;
    const sum = list.reduce((acc, a) => acc + (a.successRate || 0), 0);
    return Math.round(sum / list.length);
  });

  bestRate = computed(() => {
    const list = this.attempts();
    if (!list.length) return 0;
    return Math.max(...list.map((a) => a.successRate || 0));
  });
}
