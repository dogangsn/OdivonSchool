import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, filter, firstValueFrom, of, switchMap } from 'rxjs';
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
import { ClassTrackingComponent } from '../class-tracking/class-tracking';
import { LiveService } from '../../../core/services/live';
import { poolToLive, quizItemToLive } from '../../../core/live-scoring';
import { LiveQuestion } from '../../../models/live';
import { AccountResult, StudentAccountService } from '../../../core/services/student-accounts';
import { MAX_ACCOUNTS_PER_BATCH, parseNameList } from '../../../core/student-accounts';
import { DuelService } from '../../../core/services/duel';
import { DuelQuestionService, DuelSource } from '../../../core/services/duel-questions';
import { ClassMessageService, MESSAGE_MAX_LENGTH } from '../../../core/services/class-messages';
import { DUEL_MAX_INVITED, DUEL_SECONDS_PER_QUESTION, duelPath } from '../../../core/duel';
import { AUDIENCE_ALL, ClassMessage, Duel } from '../../../models/duel';

type Tab = 'takip' | 'odevler' | 'ogrenciler' | 'mesajlar';

interface KindChoice {
  kind: AssignmentKind;
  title: string;
  hint: string;
}

/** /ogretmen/sinif/:classId — join code, tracking, students, assignments and results. */
@Component({
  selector: 'app-class-detail',
  imports: [FormsModule, RouterLink, DatePipe, ClassTrackingComponent],
  templateUrl: './class-detail.html',
  styleUrl: './class-detail.scss',
})
export class ClassDetail {
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private classroomSvc = inject(ClassroomService);
  private firestoreSvc = inject(FirestoreService);
  private liveSvc = inject(LiveService);
  private accountSvc = inject(StudentAccountService);
  private router = inject(Router);
  private duelSvc = inject(DuelService);
  private duelQuestions = inject(DuelQuestionService);
  private messageSvc = inject(ClassMessageService);

  readonly classId = this.route.snapshot.paramMap.get('classId') ?? '';
  readonly kindLabels = KIND_LABELS;
  readonly liveDurations = [10, 20, 30];
  readonly liveCounts = [5, 10, 15];
  readonly speedPresets = SPEED_PRESETS;
  readonly messageMax = MESSAGE_MAX_LENGTH;
  readonly audienceAll = AUDIENCE_ALL;
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

  tab = signal<Tab>('takip');
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

  // --- Live competition drawer ---
  liveOpen = signal(false);
  liveSource = signal<'content' | 'pool'>('pool');
  liveRef = signal<string | null>(null);
  liveTitle = '';
  liveDuration = signal(20);
  liveCount = signal(10);
  liveStarting = signal(false);
  liveError = signal<string | null>(null);
  activeLive = toSignal(this.liveSvc.activeSessions(this.classId), { initialValue: [] });

  // --- Teacher-created student accounts ---
  readonly maxAccounts = MAX_ACCOUNTS_PER_BATCH;
  accounts = toSignal(this.accountSvc.accounts(this.classId), { initialValue: [] });
  usernameByUid = computed(() => new Map(this.accounts().map((a) => [a.uid, a.username])));
  accountsOpen = signal(false);
  nameList = '';
  parsedNames = signal<string[]>([]);
  accountProgress = signal<{ done: number; total: number } | null>(null);
  accountResults = signal<AccountResult[] | null>(null);
  accountError = signal<string | null>(null);
  okResults = computed(() => (this.accountResults() ?? []).filter((r) => r.account));
  failedResults = computed(() => (this.accountResults() ?? []).filter((r) => r.error));

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

  openLive() {
    this.liveSource.set(this.quizContent().length ? 'content' : 'pool');
    this.liveRef.set(null);
    this.liveTitle = '';
    this.liveError.set(null);
    this.liveOpen.set(true);
  }

  chooseLiveSource(source: 'content' | 'pool') {
    this.liveSource.set(source);
    this.liveRef.set(null);
    this.liveTitle = '';
  }

  chooseLiveRef(id: string, title: string) {
    this.liveRef.set(id);
    this.liveTitle = title;
  }

  async startLive() {
    const ref = this.liveRef();
    const teacherId = this.classroom()?.teacherId;
    if (!ref || !teacherId) {
      this.liveError.set('Yarışmanın sorularını seçin.');
      return;
    }
    this.liveStarting.set(true);
    this.liveError.set(null);
    try {
      let questions: LiveQuestion[];
      let subject = '';
      let categoryId: string | null = null;
      if (this.liveSource() === 'content') {
        const content = this.quizContent().find((c) => c.id === ref);
        questions = (content?.quizItems ?? []).slice(0, 20).map(quizItemToLive);
        subject = content?.subject ?? '';
      } else {
        const cat = this.gradeCategories().find((c) => c.id === ref);
        const pool = await firstValueFrom(this.firestoreSvc.questionsForCategory(ref, this.liveCount()));
        questions = pool.map(poolToLive);
        subject = cat?.subject ?? '';
        categoryId = ref;
      }
      if (questions.length === 0) {
        this.liveError.set('Bu konuda henüz onaylı soru yok. Başka bir konu ya da kendi testinizi seçin.');
        return;
      }
      const id = await this.liveSvc.create(this.classId, teacherId, {
        title: this.liveTitle.trim() || 'Canlı yarışma',
        subject,
        categoryId,
        durationSec: this.liveDuration(),
        questions,
      });
      await this.router.navigate(['/ogretmen/canli', this.classId, id]);
    } catch (err: any) {
      this.liveError.set(`Yarışma başlatılamadı: ${err?.message ?? err}`);
    } finally {
      this.liveStarting.set(false);
    }
  }

  openAccounts() {
    this.nameList = '';
    this.parsedNames.set([]);
    this.accountResults.set(null);
    this.accountError.set(null);
    this.accountProgress.set(null);
    this.accountsOpen.set(true);
  }

  onNamesChange(text: string) {
    this.nameList = text;
    this.parsedNames.set(parseNameList(text));
  }

  async createAccounts() {
    const c = this.classroom();
    const names = this.parsedNames();
    if (!c || names.length === 0 || this.accountProgress()) return;
    if (names.length > MAX_ACCOUNTS_PER_BATCH) {
      this.accountError.set(`Bir seferde en fazla ${MAX_ACCOUNTS_PER_BATCH} hesap açılabilir.`);
      return;
    }
    this.accountError.set(null);
    this.accountProgress.set({ done: 0, total: names.length });
    try {
      const results = await this.accountSvc.createAccounts(c, names, (done, total) =>
        this.accountProgress.set({ done, total })
      );
      this.accountResults.set(results);
    } catch (err: any) {
      this.accountError.set(`Hesaplar açılamadı: ${err?.message ?? err}`);
    } finally {
      this.accountProgress.set(null);
    }
  }

  // --- Karşılaşma (teacher-set duel) drawer ---
  duelOpen = signal(false);
  duelPicked = signal<Set<string>>(new Set());
  duelSource = signal<DuelSource>('content');
  duelRef = signal<string | null>(null);
  duelTitle = '';
  duelNote = '';
  duelCount = signal(10);
  duelBusy = signal(false);
  duelError = signal<string | null>(null);
  myDuels = toSignal(
    this.auth.appUser$.pipe(switchMap((u) => (u ? this.duelSvc.byTeacher(this.classId, u.uid) : of([])))),
    { initialValue: [] as Duel[] }
  );
  openDuels = computed(() => this.myDuels().filter((d) => d.status !== 'finished').slice(0, 5));

  openDuel(preselect: string[] = []) {
    this.duelPicked.set(new Set(preselect));
    this.duelSource.set(this.quizContent().length ? 'content' : 'pool');
    this.duelRef.set(null);
    this.duelTitle = '';
    this.duelNote = '';
    this.duelError.set(null);
    this.duelOpen.set(true);
  }

  toggleDuelStudent(uid: string) {
    this.duelPicked.update((set) => {
      const next = new Set(set);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  }

  pickAllForDuel(all: boolean) {
    this.duelPicked.set(new Set(all ? this.members().map((m) => m.uid).slice(0, DUEL_MAX_INVITED) : []));
  }

  chooseDuelSource(source: DuelSource) {
    this.duelSource.set(source);
    this.duelRef.set(null);
    this.duelTitle = '';
  }

  chooseDuelRef(id: string, title: string) {
    this.duelRef.set(id);
    this.duelTitle = title;
  }

  async createDuel() {
    const user = await firstValueFrom(this.auth.appUser$);
    const ref = this.duelRef();
    const invited = [...this.duelPicked()];
    if (!user) return;
    if (invited.length === 0) return this.duelError.set('Karşılaşacak öğrencileri seçin.');
    if (invited.length > DUEL_MAX_INVITED) return this.duelError.set(`En fazla ${DUEL_MAX_INVITED} öğrenci seçebilirsiniz.`);
    if (!ref) return this.duelError.set('Soruları seçin.');
    this.duelBusy.set(true);
    this.duelError.set(null);
    try {
      const cat = this.gradeCategories().find((c) => c.id === ref);
      const set = await this.duelQuestions.build(this.duelSource(), ref, this.duelCount(), {
        content: this.quizContent().find((c) => c.id === ref),
        topic: cat?.topic,
        subject: cat?.subject,
      });
      if (set.questions.length === 0) {
        this.duelError.set('Bu seçimde soru yok. Başka bir konu ya da test seçin.');
        return;
      }
      const title = this.duelTitle.trim() || set.title || 'Karşılaşma';
      const id = await this.duelSvc.createTeacherDuel(this.classId, user, {
        title,
        subject: set.subject,
        questions: set.questions,
        timeLimitSec: Math.max(30, set.questions.length * DUEL_SECONDS_PER_QUESTION),
        invited,
      });
      const note = this.duelNote.trim() || `"${title}" karşılaşmasına davetlisin! Linke tıkla ve Katıl'a bas, başlatınca sorular gelecek.`;
      await this.messageSvc.send(this.classId, user, note, invited, { path: duelPath(this.classId, id), label: '⚔️ Karşılaşmaya katıl' });
      await this.router.navigate(['/duello', this.classId, id]);
    } catch (err: any) {
      this.duelError.set(`Karşılaşma kurulamadı: ${err?.message ?? err}`);
    } finally {
      this.duelBusy.set(false);
    }
  }

  // --- Mesajlar ---
  messages = toSignal(this.messageSvc.sent(this.classId), { initialValue: [] as ClassMessage[] });
  messageText = '';
  messageToAll = signal(true);
  messagePicked = signal<Set<string>>(new Set());
  messageBusy = signal(false);
  messageInfo = signal<{ type: 'success' | 'danger'; text: string } | null>(null);
  memberName = computed(() => new Map(this.members().map((m) => [m.uid, m.displayName])));

  toggleMessageStudent(uid: string) {
    this.messagePicked.update((set) => {
      const next = new Set(set);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  }

  /** Opens the Mesajlar tab addressed to one student. */
  messageStudent(uid: string) {
    this.messageToAll.set(false);
    this.messagePicked.set(new Set([uid]));
    this.messageInfo.set(null);
    this.tab.set('mesajlar');
  }

  async sendMessage() {
    const user = await firstValueFrom(this.auth.appUser$);
    const text = this.messageText.trim();
    const audience = this.messageToAll() ? [AUDIENCE_ALL] : [...this.messagePicked()];
    if (!user || !text || this.messageBusy()) return;
    if (audience.length === 0) {
      this.messageInfo.set({ type: 'danger', text: 'Mesajın gideceği öğrencileri seçin.' });
      return;
    }
    this.messageBusy.set(true);
    this.messageInfo.set(null);
    try {
      await this.messageSvc.send(this.classId, user, text, audience.slice(0, 60));
      this.messageText = '';
      this.messageInfo.set({
        type: 'success',
        text: this.messageToAll() ? 'Mesaj tüm sınıfa gönderildi.' : `Mesaj ${audience.length} öğrenciye gönderildi.`,
      });
    } catch (err: any) {
      this.messageInfo.set({ type: 'danger', text: `Gönderilemedi: ${err?.message ?? err}` });
    } finally {
      this.messageBusy.set(false);
    }
  }

  async deleteMessage(m: ClassMessage) {
    if (!confirm('Bu mesaj öğrencilerin ekranından da silinsin mi?')) return;
    await this.messageSvc.remove(this.classId, m.id);
  }

  audienceLabel(m: ClassMessage): string {
    if (m.audience.includes(AUDIENCE_ALL)) return 'Tüm sınıf';
    const names = m.audience.map((uid) => this.memberName().get(uid) ?? 'Ayrılan öğrenci');
    return names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} +${names.length - 3}`;
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
