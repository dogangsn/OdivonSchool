import { Injectable, inject } from '@angular/core';
import { Firestore, addDoc, collection, doc, updateDoc } from '@angular/fire/firestore';
import { firstValueFrom, take } from 'rxjs';
import { AuthService } from './auth';
import { ClassroomService } from './classroom';
import { AssignmentRef } from '../../models/classroom';
import { GameOutcome, GameResultDoc, GameReward } from '../../games/game-models';
import { entryFromOutcome } from '../tracking';
import {
  levelForXp,
  levelProgress,
  localDay,
  newBadges,
  nextStreak,
  xpForOutcome,
} from '../../games/scoring';

const MAX_SAVED_MISTAKES = 20;

/**
 * Applies a finished game: stores the result, then adds XP, updates the daily
 * streak and awards badges on the user document. Guests get the same reward
 * preview without anything being saved.
 */
@Injectable({ providedIn: 'root' })
export class GameProgressService {
  private firestore = inject(Firestore);
  private auth = inject(AuthService);
  private classroom = inject(ClassroomService);

  /** `assignment` is set when the game was played as a teacher's ödev. */
  async complete(
    outcome: GameOutcome,
    assignment?: AssignmentRef | null,
    preview = false
  ): Promise<GameReward> {
    const user = await firstValueFrom(this.auth.appUser$.pipe(take(1)));
    const xpGained = xpForOutcome(outcome);
    const now = new Date();

    const prevXp = user?.xp ?? 0;
    const xpTotal = prevXp + xpGained;
    const streakDays = nextStreak(user?.lastPlayedDate, user?.streakDays ?? 0, now);
    const owned = user?.badges ?? [];
    const earned = newBadges({ outcome, xpTotal, streakDays }, owned);

    const reward: GameReward = {
      xpGained,
      xpTotal,
      level: levelForXp(xpTotal),
      levelProgress: levelProgress(xpTotal),
      streakDays,
      newBadges: earned,
      saved: false,
    };
    if (preview) return { ...reward, preview: true };
    if (!user) return reward;

    const { meta, ...rest } = outcome;
    const result: GameResultDoc = {
      ...rest,
      mistakes: outcome.mistakes.slice(0, MAX_SAVED_MISTAKES),
      userId: user.uid,
      createdAt: now.getTime(),
    };
    if (result.categoryId === undefined) delete result.categoryId;
    if (assignment) {
      result.classId = assignment.classId;
      result.assignmentId = assignment.assignmentId;
    }

    try {
      await addDoc(collection(this.firestore, 'gameResults'), result);
      await updateDoc(doc(this.firestore, `users/${user.uid}`), {
        xp: xpTotal,
        streakDays,
        lastPlayedDate: localDay(now),
        badges: [...owned, ...earned.map((b) => b.id)],
      });
      reward.saved = true;
    } catch (err) {
      console.error('[GameProgress] saving result failed:', err);
    }
    await this.classroom.recordProgress(user, entryFromOutcome(outcome), streakDays);
    if (assignment) {
      try {
        await this.classroom.submit(assignment, outcome);
        reward.submitted = true;
      } catch (err) {
        console.error('[GameProgress] saving assignment submission failed:', err);
        reward.submitted = false;
      }
    }
    return reward;
  }
}
