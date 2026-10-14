import { Component, OnDestroy, computed, inject, input, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GameResult } from '../game-result/game-result';
import { GameProgressService } from '../../../core/services/game-progress';
import { GameMistake, GameOutcome, GameReward } from '../../../games/game-models';
import { MatchSet, matchSetById, pairsForGame } from '../../../games/match-sets';
import { AssignmentRef } from '../../../models/classroom';
import { shuffled } from '../../../games/math-generator';
import { matchStars } from '../../../games/scoring';
import { setSoundEnabled, sfx, soundEnabled, speak, speechSupported } from '../../../games/sound';

interface Card {
  id: number;
  pairId: number;
  text: string;
  side: 'a' | 'b';
  state: 'down' | 'up' | 'matched';
}

type Phase = 'intro' | 'playing' | 'done';

/** Eşleştir: classic memory cards, each pair is a term and its match. */
@Component({
  selector: 'app-memory-match',
  imports: [RouterLink, GameResult],
  templateUrl: './memory-match.html',
  styleUrl: './memory-match.scss',
})
export class MemoryMatch implements OnDestroy {
  private route = inject(ActivatedRoute);
  private progress = inject(GameProgressService);

  /** A teacher's set (ödev); otherwise the built-in set from the route. */
  customSet = input<MatchSet | null>(null);
  assignment = input<AssignmentRef | null>(null);
  backLink = input('/oyunlar');
  /** Teacher preview: plays normally but nothing is saved. */
  preview = input(false);

  readonly set = computed(
    () => this.customSet() ?? matchSetById(this.route.snapshot.paramMap.get('setId') ?? '')
  );
  readonly canSpeak = speechSupported();

  phase = signal<Phase>('intro');
  cards = signal<Card[]>([]);
  mistakes = signal(0);
  seconds = signal(0);
  sound = signal(soundEnabled());
  outcome = signal<GameOutcome | null>(null);
  reward = signal<GameReward | null>(null);

  pairCount = computed(() => this.cards().length / 2);
  matchedPairs = computed(() => this.cards().filter((c) => c.state === 'matched').length / 2);

  private pairs: [string, string][] = [];
  private open: Card[] = [];
  private busy = false;
  private mistakeLog: GameMistake[] = [];
  private startedAt = 0;
  private tick: ReturnType<typeof setInterval> | null = null;
  private flipBack: ReturnType<typeof setTimeout> | null = null;

  start() {
    const set = this.set();
    if (!set) return;
    this.pairs = pairsForGame(set);
    const cards: Card[] = [];
    this.pairs.forEach(([a, b], pairId) => {
      cards.push({ id: pairId * 2, pairId, text: a, side: 'a', state: 'down' });
      cards.push({ id: pairId * 2 + 1, pairId, text: b, side: 'b', state: 'down' });
    });
    this.cards.set(shuffled(Math.random, cards));
    this.mistakes.set(0);
    this.seconds.set(0);
    this.mistakeLog = [];
    this.open = [];
    this.busy = false;
    this.outcome.set(null);
    this.reward.set(null);
    this.phase.set('playing');
    this.startedAt = Date.now();
    this.stopTick();
    this.tick = setInterval(() => this.seconds.set(Math.floor((Date.now() - this.startedAt) / 1000)), 500);
  }

  flip(card: Card) {
    if (this.busy || card.state !== 'down' || this.phase() !== 'playing') return;
    sfx.flip();
    if (this.canSpeak && this.sound()) speak(card.text);
    this.setState([card.id], 'up');
    this.open.push(card);
    if (this.open.length < 2) return;

    const [first, second] = this.open;
    this.open = [];
    if (first.pairId === second.pairId) {
      this.setState([first.id, second.id], 'matched');
      sfx.correct();
      if (this.matchedPairs() === this.pairCount()) this.finish();
      return;
    }

    this.mistakes.update((n) => n + 1);
    this.logMistake(first, second);
    sfx.wrong();
    this.busy = true;
    this.flipBack = setTimeout(() => {
      this.setState([first.id, second.id], 'down');
      this.busy = false;
    }, 900);
  }

  toggleSound() {
    const on = !this.sound();
    this.sound.set(on);
    setSoundEnabled(on);
  }

  ngOnDestroy() {
    this.stopTick();
    if (this.flipBack) clearTimeout(this.flipBack);
  }

  private setState(ids: number[], state: Card['state']) {
    this.cards.update((list) => list.map((c) => (ids.includes(c.id) ? { ...c, state } : c)));
  }

  private logMistake(first: Card, second: Card) {
    const pair = this.pairs[first.pairId];
    const partner = first.side === 'a' ? pair[1] : pair[0];
    if (this.mistakeLog.some((m) => m.prompt === first.text)) return;
    this.mistakeLog.push({ prompt: first.text, correctAnswer: partner, given: second.text });
  }

  private stopTick() {
    if (this.tick) clearInterval(this.tick);
    this.tick = null;
  }

  private async finish() {
    const set = this.set();
    if (!set) return;
    this.stopTick();
    this.phase.set('done');
    sfx.finish();
    const durationMs = Date.now() - this.startedAt;
    const pairs = this.pairCount();
    const mistakes = this.mistakes();
    const outcome: GameOutcome = {
      gameType: 'match',
      gameKey: set.id,
      title: `Eşleştir · ${set.title}`,
      subject: set.subject,
      grade: set.grades.length === 1 ? set.grades[0] : null,
      score: Math.max(50, 600 - mistakes * 40 - Math.floor(durationMs / 1000) * 2),
      stars: matchStars(mistakes),
      correct: pairs,
      total: pairs + mistakes,
      durationMs,
      mistakes: this.mistakeLog,
      meta: { matchMistakes: mistakes },
    };
    this.outcome.set(outcome);
    this.reward.set(await this.progress.complete(outcome, this.assignment(), this.preview()));
  }
}
