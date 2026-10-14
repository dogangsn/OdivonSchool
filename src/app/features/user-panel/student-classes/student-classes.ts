import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth';
import { ClassroomService, StudentAssignment } from '../../../core/services/classroom';
import { KIND_LABELS } from '../../../models/classroom';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Student dashboard block: join a class with a code, see classes and ödevler. */
@Component({
  selector: 'app-student-classes',
  imports: [FormsModule, RouterLink, DatePipe],
  templateUrl: './student-classes.html',
  styleUrl: './student-classes.scss',
})
export class StudentClasses {
  private auth = inject(AuthService);
  private classroom = inject(ClassroomService);

  readonly kindLabels = KIND_LABELS;
  readonly now = Date.now();

  classes = toSignal(
    this.auth.appUser$.pipe(switchMap((u) => (u ? this.classroom.studentClasses(u) : of([])))),
    { initialValue: [] }
  );
  assignments = toSignal(
    this.auth.appUser$.pipe(switchMap((u) => (u ? this.classroom.studentAssignments(u) : of([])))),
    { initialValue: [] as StudentAssignment[] }
  );

  pending = computed(() => this.assignments().filter((a) => !a.submission));
  done = computed(() => this.assignments().filter((a) => a.submission).slice(0, 6));

  code = '';
  joining = signal(false);
  message = signal<{ type: 'success' | 'danger'; text: string } | null>(null);
  showJoin = signal(false);

  async join() {
    if (!this.code.trim() || this.joining()) return;
    this.joining.set(true);
    this.message.set(null);
    try {
      const name = await this.classroom.joinWithCode(this.code);
      this.message.set({ type: 'success', text: `🎉 "${name}" sınıfına katıldın!` });
      this.code = '';
      this.showJoin.set(false);
    } catch (err: any) {
      const text =
        err?.code === 'permission-denied'
          ? 'Bu sınıfa katılamadın. Kodun doğru olduğundan emin ol.'
          : (err?.message ?? 'Sınıfa katılırken bir sorun oluştu.');
      this.message.set({ type: 'danger', text });
    } finally {
      this.joining.set(false);
    }
  }

  dueLabel(dueAt: number | null): { text: string; tone: string } | null {
    if (!dueAt) return null;
    const left = dueAt - this.now;
    if (left < 0) return { text: 'Süresi geçti', tone: 'red' };
    if (left < DAY_MS) return { text: 'Bugün son gün', tone: 'amber' };
    const days = Math.ceil(left / DAY_MS);
    return { text: `${days} gün kaldı`, tone: days <= 2 ? 'amber' : 'indigo' };
  }

  stars(n: number): string {
    return '★'.repeat(n) + '☆'.repeat(3 - n);
  }
}
