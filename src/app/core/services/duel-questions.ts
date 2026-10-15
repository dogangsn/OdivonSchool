import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FirestoreService } from './firestore';
import { LiveQuestion } from '../../models/live';
import { TeacherContent } from '../../models/classroom';
import { presetById } from '../../games/math-generator';
import { poolToLive, quizItemToLive } from '../live-scoring';
import { DUEL_MAX_QUESTIONS, speedDuelQuestions } from '../duel';

export type DuelSource = 'speed' | 'pool' | 'content';

export interface DuelQuestionSet {
  questions: LiveQuestion[];
  subject: string;
  title: string;
}

/** Turns a Hız Turu preset, a pool topic or a teacher's test into duel questions. */
@Injectable({ providedIn: 'root' })
export class DuelQuestionService {
  private firestore = inject(FirestoreService);

  async build(
    source: DuelSource,
    ref: string,
    count: number,
    opts: { content?: TeacherContent; topic?: string; subject?: string } = {}
  ): Promise<DuelQuestionSet> {
    const n = Math.min(count, DUEL_MAX_QUESTIONS);
    if (source === 'speed') {
      const preset = presetById(ref);
      if (!preset) return { questions: [], subject: 'Matematik', title: '' };
      return { questions: speedDuelQuestions(preset, n), subject: 'Matematik', title: preset.title };
    }
    if (source === 'content') {
      const c = opts.content;
      return {
        questions: (c?.quizItems ?? []).slice(0, DUEL_MAX_QUESTIONS).map(quizItemToLive),
        subject: c?.subject ?? '',
        title: c?.title ?? '',
      };
    }
    const pool = await firstValueFrom(this.firestore.questionsForCategory(ref, n));
    return { questions: pool.map(poolToLive), subject: opts.subject ?? '', title: opts.topic ?? '' };
  }
}
