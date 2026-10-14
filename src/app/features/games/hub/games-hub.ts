import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth';
import { FirestoreService } from '../../../core/services/firestore';
import { TestCategory, levelForGrade } from '../../../models/test-category';
import { SPEED_PRESETS } from '../../../games/math-generator';
import { MATCH_SETS } from '../../../games/match-sets';
import { TRUEFALSE_SETS } from '../../../games/truefalse-sets';
import { SORT_SETS } from '../../../games/sort-sets';
import { CLOCK_PRESETS } from '../../../games/clock-game';
import { NUMBERLINE_PRESETS } from '../../../games/numberline-game';
import { FRACTION_PRESETS } from '../../../games/fraction-game';
import { ALL_BADGES, levelForXp, levelProgress } from '../../../games/scoring';

const MIN_QUIZ_QUESTIONS = 3;
const DEFAULT_GRADE = 3;

interface InteractiveTile {
  id: string;
  game: string;
  title: string;
  description: string;
  emoji: string;
  link: string[];
  tile: string;
}

interface SubjectGroup {
  subject: string;
  categories: TestCategory[];
}

/** /oyunlar — the games showcase, filtered by sınıf. */
@Component({
  selector: 'app-games-hub',
  imports: [RouterLink],
  templateUrl: './games-hub.html',
  styleUrl: './games-hub.scss',
})
export class GamesHub {
  private auth = inject(AuthService);
  private firestoreSvc = inject(FirestoreService);

  readonly gradeChoices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  readonly allBadges = ALL_BADGES;

  appUser = toSignal(this.auth.appUser$, { initialValue: null });
  grade = signal(DEFAULT_GRADE);
  private gradeTouched = false;

  /** Ilkokul games stay available to older students as review. */
  private gameGrade = computed(() => Math.min(4, this.grade()));
  isReview = computed(() => this.grade() > 4);

  speedPresets = computed(() => SPEED_PRESETS.filter((p) => p.grade === this.gameGrade()));
  matchSets = computed(() => MATCH_SETS.filter((s) => s.grades.includes(this.gameGrade())));
  trueFalseSets = computed(() => TRUEFALSE_SETS.filter((s) => s.grades.includes(this.gameGrade())));
  sortSets = computed(() => SORT_SETS.filter((s) => s.grades.includes(this.gameGrade())));
  /** Etkileşimli Matematik: Saat Ustası, Sayı Doğrusu, Kesir Pizzası. */
  interactiveGames = computed<InteractiveTile[]>(() => {
    const g = this.gameGrade();
    return [
      ...CLOCK_PRESETS.filter((p) => p.grades.includes(g)).map((p) => ({ ...p, game: 'Saat Ustası', link: ['/oyun/saat', p.id], tile: 'tile-clock' })),
      ...NUMBERLINE_PRESETS.filter((p) => p.grades.includes(g)).map((p) => ({ ...p, game: 'Sayı Doğrusu', link: ['/oyun/sayi-dogrusu', p.id], tile: 'tile-numberline' })),
      ...FRACTION_PRESETS.filter((p) => p.grades.includes(g)).map((p) => ({ ...p, game: 'Kesir Pizzası', link: ['/oyun/kesir', p.id], tile: 'tile-fraction' })),
    ];
  });

  private levelCategories = toSignal(
    toObservable(this.grade).pipe(
      switchMap((g) => this.firestoreSvc.categoriesByLevel(levelForGrade(g)))
    ),
    { initialValue: [] as TestCategory[] }
  );

  private gradeCategories = computed(() =>
    this.levelCategories().filter((c) => !c.grades?.length || c.grades.includes(this.grade()))
  );

  /** Approved question count per category id (filled in lazily). */
  counts = signal<Record<string, number>>({});
  countsLoading = signal(false);

  quizGroups = computed<SubjectGroup[]>(() => {
    const counts = this.counts();
    const playable = this.gradeCategories().filter((c) => (counts[c.id] ?? 0) >= MIN_QUIZ_QUESTIONS);
    const bySubject = new Map<string, TestCategory[]>();
    for (const c of playable) {
      bySubject.set(c.subject, [...(bySubject.get(c.subject) ?? []), c]);
    }
    return [...bySubject].map(([subject, categories]) => ({ subject, categories }));
  });

  comingSoonCount = computed(
    () => this.gradeCategories().length - this.quizGroups().reduce((n, g) => n + g.categories.length, 0)
  );

  xp = computed(() => this.appUser()?.xp ?? 0);
  level = computed(() => levelForXp(this.xp()));
  progress = computed(() => levelProgress(this.xp()));
  ownedBadges = computed(() => new Set(this.appUser()?.badges ?? []));

  constructor() {
    // Start on the student's own sınıf.
    effect(() => {
      const g = this.appUser()?.grade;
      if (!this.gradeTouched && g && g >= 1 && g <= 12) this.grade.set(g);
    });

    // Count questions for the categories of the selected sınıf.
    effect(() => {
      const cats = this.gradeCategories();
      untracked(() => void this.loadCounts(cats));
    });
  }

  selectGrade(g: number) {
    this.gradeTouched = true;
    this.grade.set(g);
  }

  count(categoryId: string): number {
    return this.counts()[categoryId] ?? 0;
  }

  private async loadCounts(cats: TestCategory[]) {
    const missing = cats.filter((c) => this.counts()[c.id] === undefined);
    if (missing.length === 0) return;
    this.countsLoading.set(true);
    try {
      const results = await Promise.all(
        missing.map(async (c) => [c.id, await this.firestoreSvc.approvedCount(c.id).catch(() => 0)] as const)
      );
      this.counts.update((m) => ({ ...m, ...Object.fromEntries(results) }));
    } finally {
      this.countsLoading.set(false);
    }
  }
}
