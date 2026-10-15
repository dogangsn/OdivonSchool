import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../../core/services/auth';
import { READING_TEXTS, ReadingText, SPEED_BANDS, SpeedBand } from '../../../../games/reading-texts';
import { countWords } from '../../../../games/reading-align';

interface GradeGroup {
  grade: 1 | 2 | 3 | 4;
  band: SpeedBand;
  texts: (ReadingText & { words: number })[];
}

/** /okuma — Sesli Okuma Koçu texts grouped by sınıf; the student's own sınıf first. */
@Component({
  selector: 'app-reading-list',
  imports: [RouterLink],
  templateUrl: './reading-list.html',
  styleUrl: './reading-list.scss',
})
export class ReadingList {
  private auth = inject(AuthService);
  private appUser = toSignal(this.auth.appUser$, { initialValue: null });

  myGrade = computed(() => {
    const g = this.appUser()?.grade;
    return g && g >= 1 && g <= 4 ? g : null;
  });

  groups = computed<GradeGroup[]>(() => {
    const all = ([1, 2, 3, 4] as const).map((grade) => ({
      grade,
      band: SPEED_BANDS[grade],
      texts: READING_TEXTS.filter((t) => t.grade === grade).map((t) => ({ ...t, words: countWords(t.text) })),
    }));
    const mine = this.myGrade();
    return mine ? [...all.filter((g) => g.grade === mine), ...all.filter((g) => g.grade !== mine)] : all;
  });
}
