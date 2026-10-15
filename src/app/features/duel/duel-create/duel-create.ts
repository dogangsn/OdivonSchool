import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth';
import { ClassroomService } from '../../../core/services/classroom';
import { FirestoreService } from '../../../core/services/firestore';
import { DuelService } from '../../../core/services/duel';
import { DuelQuestionService, DuelSource } from '../../../core/services/duel-questions';
import { DUEL_SECONDS_PER_QUESTION } from '../../../core/duel';
import { Classroom } from '../../../models/classroom';
import { TestCategory, levelForGrade } from '../../../models/test-category';
import { SPEED_PRESETS } from '../../../games/math-generator';
import { isStudent } from '../../../models/user';

/** /duello/yeni — a student picks a class and a game, then shares the link. */
@Component({
  selector: 'app-duel-create',
  imports: [RouterLink],
  templateUrl: './duel-create.html',
  styleUrl: './duel-create.scss',
})
export class DuelCreate {
  private auth = inject(AuthService);
  private classroomSvc = inject(ClassroomService);
  private firestoreSvc = inject(FirestoreService);
  private duels = inject(DuelService);
  private questions = inject(DuelQuestionService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly counts = [5, 10, 15];

  user = toSignal(this.auth.appUser$, { initialValue: null });
  isStudent = computed(() => isStudent(this.user()));
  classes = toSignal(
    this.auth.appUser$.pipe(switchMap((u) => (u ? this.classroomSvc.studentClasses(u) : of([])))),
    { initialValue: [] as Classroom[] }
  );

  private wantedClass = this.route.snapshot.queryParamMap.get('sinif');
  private pickedClass = signal<string | null>(null);
  classroom = computed(() => {
    const list = this.classes();
    const id = this.pickedClass() ?? this.wantedClass;
    return list.find((c) => c.id === id) ?? list[0] ?? null;
  });
  private grade = computed(() => this.classroom()?.grade || this.user()?.grade || 0);

  source = signal<DuelSource>('speed');
  ref = signal<string | null>(null);
  count = signal(10);
  busy = signal(false);
  error = signal<string | null>(null);

  presets = computed(() => {
    const g = Math.min(4, Math.max(1, this.grade() || 1));
    const same = SPEED_PRESETS.filter((p) => p.grade === g);
    return [...same, ...SPEED_PRESETS.filter((p) => !same.includes(p))];
  });
  private levelCategories = toSignal(
    toObservable(this.grade).pipe(switchMap((g) => this.firestoreSvc.categoriesByLevel(levelForGrade(g || 4)))),
    { initialValue: [] as TestCategory[] }
  );
  categories = computed(() => {
    const g = this.grade();
    return this.levelCategories().filter((c) => !g || !c.grades?.length || c.grades.includes(g));
  });

  pickClass(id: string) {
    this.pickedClass.set(id);
    this.ref.set(null);
  }

  pickSource(s: DuelSource) {
    this.source.set(s);
    this.ref.set(null);
  }

  async create() {
    const user = this.user();
    const c = this.classroom();
    const ref = this.ref();
    if (!user || !c || !ref || this.busy()) {
      this.error.set('Önce bir oyun seç.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const cat = this.categories().find((x) => x.id === ref);
      const set = await this.questions.build(this.source(), ref, this.count(), { topic: cat?.topic, subject: cat?.subject });
      if (set.questions.length === 0) {
        this.error.set('Bu konuda henüz soru yok. Başka bir konu seç.');
        return;
      }
      const id = await this.duels.createStudentDuel(c.id, user, {
        title: set.title || 'Düello',
        subject: set.subject,
        questions: set.questions,
        timeLimitSec: Math.max(30, set.questions.length * DUEL_SECONDS_PER_QUESTION),
      });
      await this.router.navigate(['/duello', c.id, id]);
    } catch (err: any) {
      this.error.set(`Düello açılamadı: ${err?.message ?? err}`);
    } finally {
      this.busy.set(false);
    }
  }
}
