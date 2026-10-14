import { Component, inject, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { StudentClasses } from '../student-classes/student-classes';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap, of } from 'rxjs';
import { AuthService } from '../../../core/services/auth';
import { FirestoreService } from '../../../core/services/firestore';
import { isStudent } from '../../../models/user';
import { SIGNUP_GRADES, levelForGrade } from '../../../models/test-category';
import { levelForXp, levelProgress } from '../../../games/scoring';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, DatePipe, StudentClasses],
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

  // --- Games progress ---
  xp = computed(() => this.appUser()?.xp ?? 0);
  level = computed(() => levelForXp(this.xp()));
  levelProgress = computed(() => levelProgress(this.xp()));
  streakDays = computed(() => this.appUser()?.streakDays ?? 0);
  badgeCount = computed(() => this.appUser()?.badges?.length ?? 0);

  // --- "Kaçıncı sınıftasın?" for accounts created without a sınıf ---
  readonly gradeChoices = SIGNUP_GRADES;
  needsGrade = computed(() => {
    const u = this.appUser();
    return isStudent(u) && !u!.grade && u!.gradeLevel !== 'kpss';
  });
  savingGrade = signal(false);
  isStudent = computed(() => isStudent(this.appUser()));

  async chooseGrade(grade: number) {
    const u = this.appUser();
    if (!u || this.savingGrade()) return;
    this.savingGrade.set(true);
    try {
      await this.firestoreSvc.updateUserProfile(u.uid, {
        grade: grade === 0 ? null : grade,
        gradeLevel: grade === 0 ? 'kpss' : levelForGrade(grade),
      });
    } catch (err) {
      console.error('[Dashboard] saving grade failed:', err);
    } finally {
      this.savingGrade.set(false);
    }
  }
}
