import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameOutcome, GameReward } from '../../../games/game-models';

/** End-of-game screen shared by every game: stars, XP, badges and "learn from mistakes". */
@Component({
  selector: 'app-game-result',
  imports: [RouterLink],
  templateUrl: './game-result.html',
  styleUrl: './game-result.scss',
})
export class GameResult {
  outcome = input.required<GameOutcome>();
  /** null while the result is being saved. */
  reward = input<GameReward | null>(null);
  backLink = input('/oyunlar');
  replay = output<void>();

  readonly starSlots = [1, 2, 3];
  readonly confetti = Array.from({ length: 28 }, (_, i) => ({
    left: (i * 37) % 100,
    delay: (i % 7) * 0.12,
    color: ['#fbbf24', '#34d399', '#38bdf8', '#fb7185', '#a78bfa'][i % 5],
    rotate: (i * 47) % 360,
  }));

  accuracy = computed(() => {
    const o = this.outcome();
    return o.total ? Math.round((o.correct / o.total) * 100) : 0;
  });

  cheer = computed(() => {
    switch (this.outcome().stars) {
      case 3:
        return 'Muhteşem! Tam bir şampiyonsun! 🏆';
      case 2:
        return 'Harika iş çıkardın! 🎉';
      case 1:
        return 'Güzel başlangıç, bir tur daha? 💪';
      default:
        return 'Her deneme seni geliştirir. Hadi tekrar! 🌱';
    }
  });
}
