import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';
import { ClassroomService } from '../../../core/services/classroom';
import { QuestionBankService } from '../../../core/services/question-bank';
import { ExamAnswerSheet, ExamKey, OPTION_LETTERS } from '../../../models/teacher-question';
import { ExamScore, scoreExam } from '../../../core/question-criteria';

interface StudentResult {
  sheet: ExamAnswerSheet;
  score: ExamScore;
}

interface QuestionStat {
  index: number;
  prompt: string;
  outcomeCode: string | null;
  correctPct: number | null;
  /** How many picked each option. */
  picks: number[];
  blank: number;
}

interface OutcomeStatRow {
  code: string;
  questions: number;
  pct: number;
}

/** /ogretmen/sinif/:classId/sinav/:assignmentId — results per student, question and kazanım. */
@Component({
  selector: 'app-exam-report',
  imports: [RouterLink, DatePipe],
  templateUrl: './exam-report.html',
  styleUrl: './exam-report.scss',
})
export class ExamReport {
  private route = inject(ActivatedRoute);
  private classroomSvc = inject(ClassroomService);
  private bank = inject(QuestionBankService);

  readonly classId = this.route.snapshot.paramMap.get('classId') ?? '';
  readonly assignmentId = this.route.snapshot.paramMap.get('assignmentId') ?? '';
  readonly letters = OPTION_LETTERS;

  classroom = toSignal(this.classroomSvc.classById(this.classId).pipe(catchError(() => of(undefined))));
  assignment = toSignal(
    this.bank.assignmentById(this.classId, this.assignmentId).pipe(
      map((a) => a ?? null),
      catchError(() => of(null))
    ),
    { initialValue: undefined }
  );
  members = toSignal(this.classroomSvc.members(this.classId).pipe(catchError(() => of([]))), { initialValue: [] });
  sheets = toSignal(
    this.bank.answerSheets(this.classId, this.assignmentId).pipe(catchError(() => of([] as ExamAnswerSheet[]))),
    { initialValue: [] as ExamAnswerSheet[] }
  );
  key = signal<ExamKey | null>(null);
  view = signal<'ogrenci' | 'soru' | 'kazanim'>('ogrenci');

  constructor() {
    this.bank
      .examKey(this.classId, this.assignmentId)
      .then((k) => this.key.set(k))
      .catch(() => this.key.set(null));
  }

  questions = computed(() => this.assignment()?.examQuestions ?? []);

  results = computed<StudentResult[]>(() => {
    const key = this.key();
    if (!key) return [];
    return this.sheets()
      .map((sheet) => ({ sheet, score: scoreExam(sheet.answers, key) }))
      .sort((a, b) => b.score.points - a.score.points || a.sheet.displayName.localeCompare(b.sheet.displayName, 'tr'));
  });

  notTaken = computed(() => {
    const done = new Set(this.sheets().map((s) => s.uid));
    return this.members().filter((m) => !done.has(m.uid));
  });

  average = computed(() => {
    const list = this.results();
    if (!list.length) return null;
    return Math.round(list.reduce((s, r) => s + r.score.points, 0) / list.length);
  });

  questionStats = computed<QuestionStat[]>(() => {
    const key = this.key();
    const results = this.results();
    return this.questions().map((q, i) => {
      const picks = q.options.map(() => 0);
      let blank = 0;
      for (const r of results) {
        const a = r.sheet.answers[i];
        if (a >= 0 && a < picks.length) picks[a]++;
        else blank++;
      }
      const correct = key ? picks[key.correct[i]] ?? 0 : 0;
      return {
        index: i,
        prompt: q.prompt,
        outcomeCode: q.outcomeCode,
        correctPct: results.length ? Math.round((correct / results.length) * 100) : null,
        picks,
        blank,
      };
    });
  });

  outcomeStats = computed<OutcomeStatRow[]>(() => {
    const byCode = new Map<string, { questions: number; correct: number; total: number }>();
    const results = this.results();
    this.questions().forEach((q, i) => {
      if (!q.outcomeCode) return;
      const row = byCode.get(q.outcomeCode) ?? { questions: 0, correct: 0, total: 0 };
      row.questions++;
      for (const r of results) {
        row.total++;
        if (r.score.marks[i] === true) row.correct++;
      }
      byCode.set(q.outcomeCode, row);
    });
    return [...byCode.entries()]
      .map(([code, r]) => ({ code, questions: r.questions, pct: r.total ? Math.round((r.correct / r.total) * 100) : 0 }))
      .sort((a, b) => a.pct - b.pct);
  });

  tone(pct: number | null): string {
    if (pct === null) return '';
    if (pct >= 70) return 'good';
    if (pct >= 50) return 'mid';
    return 'low';
  }

  minutes(ms: number): string {
    const m = Math.round(ms / 60000);
    return m < 1 ? '<1 dk' : `${m} dk`;
  }

  print() {
    window.print();
  }
}
