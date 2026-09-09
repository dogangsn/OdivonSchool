import { Component, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FirestoreService } from '../../../core/services/firestore';

@Component({
  selector: 'app-admin-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class AdminDashboard {
  private firestoreSvc = inject(FirestoreService);

  users = toSignal(this.firestoreSvc.allUsers(), { initialValue: [] });
  attempts = toSignal(this.firestoreSvc.allAttempts(), { initialValue: [] });

  totalSubscribers = computed(
    () => this.users().filter((u) => u.subscriptionStatus === 'active').length
  );
  totalUsers = computed(() => this.users().length);
  totalAttempts = computed(() => this.attempts().length);

  overallSuccessRate = computed(() => {
    const list = this.attempts();
    if (!list.length) return 0;
    const totalCorrect = list.reduce((sum, a) => sum + a.correctCount, 0);
    const totalQuestions = list.reduce((sum, a) => sum + a.totalCount, 0);
    return totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  });
}
