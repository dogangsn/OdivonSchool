import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, filter, of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth';
import { ClassroomService } from '../../../core/services/classroom';
import { FirestoreService } from '../../../core/services/firestore';
import {
  Assignment,
  AssignmentKind,
  KIND_LABELS,
  Submission,
  TeacherContent,
} from '../../../models/classroom';
import { TestCategory, levelForGrade } from '../../../models/test-category';
import { SPEED_PRESETS } from '../../../games/math-generator';

type Tab = 'odevler' | 'ogrenciler';

interface KindChoice {
  kind: AssignmentKind;
  title: string;
  hint: string;
}

/** /ogretmen/sinif/:classId — join code, students, assignments and results. */
@Component({
  selector: 'app-class-detail',
  imports: [FormsModule, RouterLink, DatePipe],
  templateUrl: './class-detail.html',
  styleUrl: './class-detail.scss',
})
export class ClassDetail {
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private classroomSvc = inject(ClassroomService);
  private firestoreSvc = inject(FirestoreService);

  readonly classId = this.route.snapshot.paramMap.get('classId') ?? '';
  readonly kindLabels = KIND_LABELS;
  readonly speedPresets = SPEED_PRESETS;
  readonly kindChoices: KindChoice[] = [
    { kind: 'custom-quiz', title: '✍️ Kendi testim', hint: 'İçeriklerimdeki testlerden' },
    { kind: 'custom-match', title: '🧠 Eşleştirme setim', hint: 'Kendi kartlarınla Eşleştir' },
    { kind: 'pool-quiz', title: '🏆 Havuzdan konu', hint: 'MEB konusundan 10 soru' },
    { kind: 'speed', title: '⚡ Hız Turu', hint: 'Matematik, otomatik soru' },
  ];

  classroom = toSignal(
    this.classroomSvc.classById(this.classId).pipe(catchError(() => of(undefined))),
    { initialValue: undefined }
  );
  members = toSignal(this.classroomSvc.members(this.classId).pipe(catchError(() => of([]))), {
    initialValue: [],
  });
  assignments = toSignal(this.classroomSvc.assignments(this.classId).pipe(catchError(() => of([]))), {
    initialValue: [] as Assignment[],
  });
  private myContent = toSignal(
    this.auth.appUser$.pipe(switchMap((u) => (u ? this.classroomSvc.myContent(u.uid) : of([])))),
    { initialValue: [] as TeacherContent[] }
  );
  private levelCategories = toSignal(
    toObservable(this.classroom).pipe(
      filter((c) => !!c),
      switchMap((c) => this.firestoreSvc.categoriesByLevel(levelForGrade(c!.grade || 4)))
    ),
    { initialValue: [] as TestCategory[] }
  );

  tab = signal<Tab>('odevler');
  copied = signal(false);
  notice = signal<{ type: 'success' | 'danger'; text: string } | null>(null);

  // --- Results ---
  counts = signal<Record<string, number | undefined>>({});
  expandedId = signal<string | null>(null);
  submissions = toSignal(
    toObservable(this.expandedId).pipe(
      switchMap((id) => (id ? this.classroomSvc.submissions(this.classId, id) : of([])))
    ),
    { initialValue: [] as Submission[] }
  );
  sortedSubmissions = computed(() =>
    [...this.submissions()].sort((a, b) => b.bestScore - a.bestScore)
  );
  notSubmitted = computed(() => {
    const done = new Set(this.submissions().map((s) => s.uid));
    return this.members().filter((m) => !done.has(m.uid));
  });

  // --- Assign drawer ---
  drawerOpen = signal(false);
  kind = signal<AssignmentKind>('custom-quiz');
  selectedRef = signal<string | null>(null); // content id / category id / preset id
  title = '';
  dueDate = '';
  saving = signal(false);
  drawerError = signal<string | null>(null);

  quizContent = computed(() => this.myContent().filter((c) => c.type === 'quiz'));
  matchContent = computed(() => this.myContent().filter((c) => c.type === 'match'));
  gradeCategories = computed(() => {
    const g = this.classroom()?.grade;
    return this.levelCategories().filter((c) => !g || !c.grades?.length || c.grades.includes(g));
  });
  presetsForClass = computed(() => {
    const g = this.classroom()?.grade ?? 0;
    const sameGrade = SPEED_PRESETS.filter((p) => p.grade === Math.min(4, Math.max(1, g)));
    return [...sameGrade, ...SPEED_PRESETS.filter((p) => !sameGrade.includes(p))];
  });

  constructor() {
    effect(() => {
      const list = this.assignments();
      untracked(() => void this.loadCounts(list));
    });
  }

  // --- Header actions ---
  async copyCode() {
    const code = this.classroom()?.joinCode;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1800);
    } catch {
      // Clipboard may be blocked; the code is visible anyway.
    }
  }

  async regenerateCode() {
    const c = this.classroom();
    if (!c) return;
    if (!confirm('Yeni kod oluşturulsun mu? Eski kod artık çalışmaz; sınıftaki öğrenciler yerinde kalır.')) return;
    try {
      const code = await this.classroomSvc.regenerateCode(c);
      this.notice.set({ type: 'success', text: `Yeni sınıf kodu: ${code}` });
    } catch (err: any) {
      this.notice.set({ type: 'danger', text: `Kod yenilenemedi: ${err?.message ?? err}` });
    }
  }

  async toggleArchive() {
    const c = this.classroom();
    if (!c) return;
    await this.classroomSvc.archiveClass(c, !c.archived);
  }

  async removeMember(uid: string, name: string) {
    if (!confirm(`${name} sınıftan çıkarılsın mı?`)) return;
    try {
      await this.classroomSvc.removeMember(this.classId, uid);
    } catch (err: any) {
      this.notice.set({ type: 'danger', text: `Öğrenci çıkarılamadı: ${err?.message ?? err}` });
    }
  }

  // --- Assignments ---
  toggleExpanded(id: string) {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  async deleteAssignment(a: Assignment) {
    if (!confirm(`"${a.title}" ödevi silinsin mi? Öğrencilerin sonuçları da görünmez olur.`)) return;
    await this.classroomSvc.deleteAssignment(this.classId, a.id);
    if (this.expandedId() === a.id) this.expandedId.set(null);
  }

  openDrawer() {
    this.kind.set(this.quizContent().length ? 'custom-quiz' : 'pool-quiz');
    this.selectedRef.set(null);
    this.title = '';
    this.dueDate = '';
    this.drawerError.set(null);
    this.drawerOpen.set(true);
  }

  chooseKind(kind: AssignmentKind) {
    this.kind.set(kind);
    this.selectedRef.set(null);
    this.title = '';
  }

  chooseRef(id: string, title: string) {
    this.selectedRef.set(id);
    this.title = title;
  }

  async saveAssignment() {
    const ref = this.selectedRef();
    if (!ref) {
      this.drawerError.set('Ödev olarak verilecek içeriği seçin.');
      return;
    }
    const title = this.title.trim();
    if (!title) {
      this.drawerError.set('Ödeve bir başlık verin.');
      return;
    }
    const dueAt = this.dueDate ? new Date(`${this.dueDate}T23:59:00`).getTime() : null;
    const base = { kind: this.kind(), title, dueAt };

    let data: Omit<Assignment, 'id' | 'classId' | 'teacherId' | 'createdAt'>;
    switch (this.kind()) {
      case 'custom-quiz':
      case 'custom-match': {
        const content = this.myContent().find((c) => c.id === ref);
        if (!content) return;
        data = {
          ...base,
          subject: content.subject,
          contentId: content.id,
          quizItems: content.type === 'quiz' ? content.quizItems : undefined,
          pairs: content.type === 'match' ? content.pairs : undefined,
        };
        break;
      }
      case 'pool-quiz': {
        const cat = this.gradeCategories().find((c) => c.id === ref);
        data = { ...base, subject: cat?.subject ?? '', categoryId: ref };
        break;
      }
      case 'speed':
        data = { ...base, subject: 'Matematik', presetId: ref };
        break;
    }

    this.saving.set(true);
    this.drawerError.set(null);
    try {
      await this.classroomSvc.createAssignment(this.classId, data);
      this.drawerOpen.set(false);
      this.tab.set('odevler');
      this.notice.set({ type: 'success', text: `"${title}" ödevi verildi. Öğrenciler panellerinde görecek.` });
    } catch (err: any) {
      this.drawerError.set(`Ödev kaydedilemedi: ${err?.message ?? err}`);
    } finally {
      this.saving.set(false);
    }
  }

  stars(n: number): string {
    return '★'.repeat(n) + '☆'.repeat(3 - n);
  }

  minutes(ms: number): string {
    const s = Math.round(ms / 1000);
    return s < 60 ? `${s} sn` : `${Math.floor(s / 60)} dk ${s % 60} sn`;
  }

  private async loadCounts(list: Assignment[]) {
    const entries = await Promise.all(
      list.map(async (a) => [a.id, await this.classroomSvc.submissionCount(this.classId, a.id).catch(() => 0)] as const)
    );
    this.counts.set(Object.fromEntries(entries));
  }
}
