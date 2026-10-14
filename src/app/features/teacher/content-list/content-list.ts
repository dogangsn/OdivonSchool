import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth';
import { ClassroomService } from '../../../core/services/classroom';
import { TeacherContent } from '../../../models/classroom';

/** /ogretmen/icerik — the teacher's own tests and matching sets. */
@Component({
  selector: 'app-content-list',
  imports: [RouterLink, DatePipe],
  templateUrl: './content-list.html',
  styleUrl: './content-list.scss',
})
export class ContentList {
  private auth = inject(AuthService);
  private classroom = inject(ClassroomService);

  content = toSignal(
    this.auth.appUser$.pipe(switchMap((u) => (u ? this.classroom.myContent(u.uid) : of([]))))
  );

  async remove(c: TeacherContent) {
    if (!confirm(`"${c.title}" silinsin mi? Daha önce verilen ödevler etkilenmez.`)) return;
    await this.classroom.deleteContent(c.id);
  }
}
