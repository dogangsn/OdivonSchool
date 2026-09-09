import { Component, inject, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FirestoreService } from '../../../core/services/firestore';

@Component({
  selector: 'app-subscriber-detail',
  imports: [RouterLink, DatePipe],
  templateUrl: './subscriber-detail.html',
  styleUrl: './subscriber-detail.scss',
})
export class SubscriberDetail {
  private route = inject(ActivatedRoute);
  private firestoreSvc = inject(FirestoreService);

  userId = this.route.snapshot.paramMap.get('userId')!;

  user = toSignal(this.firestoreSvc.userById(this.userId), { initialValue: null });

  attempts = toSignal(this.firestoreSvc.allAttempts(), { initialValue: [] });

  userAttempts = computed(() => this.attempts().filter((a) => a.userId === this.userId));

  successRate = computed(() => {
    const list = this.userAttempts();
    if (!list.length) return 0;
    const totalCorrect = list.reduce((sum, a) => sum + a.correctCount, 0);
    const totalQuestions = list.reduce((sum, a) => sum + a.totalCount, 0);
    return totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  });
}
