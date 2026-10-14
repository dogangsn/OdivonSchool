import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth';
import { ClassroomService } from '../../../core/services/classroom';
import { Classroom } from '../../../models/classroom';

/** /ogretmen — the teacher's classes and a quick "new class" drawer. */
@Component({
  selector: 'app-teacher-home',
  imports: [FormsModule, RouterLink],
  templateUrl: './teacher-home.html',
  styleUrl: './teacher-home.scss',
})
export class TeacherHome {
  private auth = inject(AuthService);
  private classroom = inject(ClassroomService);
  private router = inject(Router);

  readonly gradeChoices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  appUser = toSignal(this.auth.appUser$, { initialValue: null });
  classes = toSignal(
    this.auth.appUser$.pipe(switchMap((u) => (u ? this.classroom.myClasses(u.uid) : of([]))))
  );

  drawerOpen = signal(false);
  newName = '';
  newGrade = signal(3);
  saving = signal(false);
  error = signal<string | null>(null);

  openDrawer() {
    this.newName = '';
    this.error.set(null);
    this.drawerOpen.set(true);
  }

  async createClass() {
    if (!this.newName.trim()) {
      this.error.set('Sınıfa bir ad verin (ör. 3-B Matematik).');
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      const id = await this.classroom.createClass(this.newName, this.newGrade());
      this.drawerOpen.set(false);
      this.router.navigate(['/ogretmen/sinif', id]);
    } catch (err: any) {
      console.error('[TeacherHome] createClass failed:', err);
      this.error.set(
        err?.code === 'permission-denied'
          ? 'Sınıf oluşturma yetkiniz yok. Hesabınızın öğretmen hesabı olduğundan emin olun.'
          : (err?.message ?? 'Sınıf oluşturulamadı.')
      );
    } finally {
      this.saving.set(false);
    }
  }
}
