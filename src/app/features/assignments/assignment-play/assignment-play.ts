import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';
import { ClassroomService } from '../../../core/services/classroom';
import { AssignmentRef } from '../../../models/classroom';
import { SpeedRound } from '../../games/speed-round/speed-round';
import { Quiz } from '../../games/quiz/quiz';
import { MemoryMatch } from '../../games/memory-match/memory-match';
import { ExamPlay } from '../exam-play/exam-play';
import { assignmentMatchSet, quizItemsToQuestions } from '../../../games/teacher-games';

/** /odev/:classId/:assignmentId — plays an assignment with the matching game. */
@Component({
  selector: 'app-assignment-play',
  imports: [RouterLink, SpeedRound, Quiz, MemoryMatch, ExamPlay],
  templateUrl: './assignment-play.html',
})
export class AssignmentPlay {
  private route = inject(ActivatedRoute);
  private classroom = inject(ClassroomService);

  readonly ref: AssignmentRef = {
    classId: this.route.snapshot.paramMap.get('classId') ?? '',
    assignmentId: this.route.snapshot.paramMap.get('assignmentId') ?? '',
  };

  /** undefined = loading, null = missing or no access. */
  assignment = toSignal(
    this.classroom.assignment(this.ref).pipe(
      map((a) => a ?? null),
      catchError(() => of(null))
    ),
    { initialValue: undefined }
  );

  questions = computed(() => {
    const a = this.assignment();
    return a?.quizItems ? quizItemsToQuestions(a.quizItems, a.subject, a.id) : null;
  });

  matchSet = computed(() => {
    const a = this.assignment();
    return a?.pairs ? assignmentMatchSet(a) : null;
  });
}
