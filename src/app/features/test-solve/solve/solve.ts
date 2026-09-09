import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FirestoreService } from '../../../core/services/firestore';
import { AuthService } from '../../../core/services/auth';
import { TestSessionService } from '../../../core/services/test-session';
import { GuestQuotaService } from '../../../core/services/guest-quota';

const QUESTIONS_PER_TEST = 10;

@Component({
  selector: 'app-solve',
  imports: [RouterLink],
  providers: [TestSessionService], // fresh session state per attempt
  templateUrl: './solve.html',
  styleUrl: './solve.scss',
})
export class Solve implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private firestoreSvc = inject(FirestoreService);
  private auth = inject(AuthService);
  guestQuota = inject(GuestQuotaService);
  session = inject(TestSessionService);

  categoryId = this.route.snapshot.paramMap.get('categoryId')!;
  appUser = toSignal(this.auth.appUser$, { initialValue: null });
  category = toSignal(this.firestoreSvc.categoryById(this.categoryId), { initialValue: null });

  selectedOptionId = signal<string | null>(null);
  showExplanation = signal(false);
  isAnswerChecked = signal(false);
  lastAnswerCorrect = signal<boolean | null>(null);
  isLoading = signal(true);
  isQuotaBlocked = signal(false);
  private questionStartedAt = Date.now();

  ngOnInit() {
    // Check if guest has exceeded trial quota
    if (!this.appUser() && !this.guestQuota.canSolve()) {
      this.isQuotaBlocked.set(true);
      this.isLoading.set(false);
      return;
    }

    this.firestoreSvc.questionsForCategory(this.categoryId, QUESTIONS_PER_TEST).subscribe((qs) => {
      this.session.start(qs);
      this.questionStartedAt = Date.now();
      this.isLoading.set(false);
    });
  }

  selectOption(optionId: string) {
    if (this.isAnswerChecked() || this.showExplanation()) return;
    this.selectedOptionId.set(optionId);
  }

  confirmAnswer() {
    const optionId = this.selectedOptionId();
    if (!optionId || this.isAnswerChecked()) return;

    const timeSpent = Math.round((Date.now() - this.questionStartedAt) / 1000);
    const isCorrect = this.session.answerCurrent(optionId, timeSpent);
    this.lastAnswerCorrect.set(isCorrect);
    this.isAnswerChecked.set(true);

    if (isCorrect) {
      // Correct answer feedback: visual delay to see green checkmark
      setTimeout(() => {
        this.goToNext();
      }, 1000);
    } else {
      // Wrong answer: show educational explanation
      this.showExplanation.set(true);
    }
  }

  goToNext() {
    this.showExplanation.set(false);
    this.selectedOptionId.set(null);
    this.lastAnswerCorrect.set(null);
    this.isAnswerChecked.set(false);
    this.questionStartedAt = Date.now();

    if (this.session.isLastQuestion()) {
      this.finishTest();
    } else {
      this.session.next();
    }
  }

  private async finishTest() {
    const user = this.appUser();
    const cat = this.category();
    const q = this.session.currentQuestion();
    const level = cat?.level ?? q?.level ?? '';
    const subject = cat ? `${cat.subject} - ${cat.topic}` : (q?.subject ?? '');

    if (user) {
      await this.session.finish(user.uid, this.categoryId, level, subject);
    } else {
      // Guest attempt - save into local storage quota
      const attempt = await this.session.finish('guest', this.categoryId, level, subject);
      this.guestQuota.recordGuestAttempt(attempt);
    }

    this.router.navigate(['/test', this.categoryId, 'sonuc']);
  }
}
