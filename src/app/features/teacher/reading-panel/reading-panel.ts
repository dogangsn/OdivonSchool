import { Component, computed, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { ReadingService } from '../../../core/services/reading';
import { ReadingSummary, classStruggledWords } from '../../../games/reading-summary';
import { readingTextById } from '../../../games/reading-texts';
import { ClassMember, Classroom } from '../../../models/classroom';

const collator = new Intl.Collator('tr');

/** "Takip" tab card: each student's read-aloud speed, accuracy and struggled words. */
@Component({
  selector: 'app-reading-panel',
  imports: [DatePipe],
  templateUrl: './reading-panel.html',
  styleUrl: './reading-panel.scss',
})
export class ReadingPanel {
  private readingSvc = inject(ReadingService);

  classroom = input.required<Classroom>();
  members = input.required<ClassMember[]>();

  private summaries = toSignal(
    toObservable(this.classroom).pipe(switchMap((c) => this.readingSvc.classReading(c.id))),
    { initialValue: [] as ReadingSummary[] }
  );

  /** Only current members, by name. */
  rows = computed(() => {
    const names = new Map(this.members().map((m) => [m.uid, m.displayName]));
    return this.summaries()
      .filter((r) => names.has(r.uid))
      .map((r) => ({ ...r, name: names.get(r.uid) || r.displayName, textTitle: readingTextById(r.lastTextId)?.title ?? '' }))
      .sort((a, b) => collator.compare(a.name, b.name));
  });

  classWords = computed(() => classStruggledWords(this.rows(), 10).filter((w) => w.students > 1));
}
