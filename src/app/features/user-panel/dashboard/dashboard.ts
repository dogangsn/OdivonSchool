import { Component, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap, of } from 'rxjs';
import { AuthService } from '../../../core/services/auth';
import { FirestoreService } from '../../../core/services/firestore';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, DatePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private auth = inject(AuthService);
  private firestoreSvc = inject(FirestoreService);

  appUser = toSignal(this.auth.appUser$, { initialValue: null });

  attempts = toSignal(
    this.auth.appUser$.pipe(
      switchMap((appUser) => (appUser ? this.firestoreSvc.attemptsForUser(appUser.uid) : of([])))
    ),
    { initialValue: [] }
  );

  totalAttempts = computed(() => this.attempts().length);

  totalQuestions = computed(() =>
    this.attempts().reduce((sum, a) => sum + (a.totalCount || 0), 0)
  );

  totalCorrect = computed(() =>
    this.attempts().reduce((sum, a) => sum + (a.correctCount || 0), 0)
  );

  overallSuccessRate = computed(() => {
    const totalQ = this.totalQuestions();
    const totalC = this.totalCorrect();
    return totalQ ? Math.round((totalC / totalQ) * 100) : 0;
  });

  recentAttempts = computed(() => this.attempts().slice(0, 5));
}
