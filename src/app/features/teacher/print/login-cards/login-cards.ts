import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { ClassroomService } from '../../../../core/services/classroom';
import { StudentAccountService } from '../../../../core/services/student-accounts';

interface Card {
  name: string;
  username: string;
  password: string | null;
}

/** /ogretmen/sinif/:classId/kartlar — printable login cards (8 per A4 page). */
@Component({
  selector: 'app-login-cards',
  imports: [RouterLink],
  templateUrl: './login-cards.html',
  styleUrl: './login-cards.scss',
})
export class LoginCards {
  private route = inject(ActivatedRoute);
  private classroomSvc = inject(ClassroomService);
  private accountSvc = inject(StudentAccountService);

  readonly classId = this.route.snapshot.paramMap.get('classId') ?? '';
  readonly site = location.origin.replace(/^https?:\/\//, '');
  private fresh = this.accountSvc.freshResults(this.classId);

  classroom = toSignal(this.classroomSvc.classById(this.classId).pipe(catchError(() => of(undefined))));
  accounts = toSignal(this.accountSvc.accounts(this.classId), { initialValue: [] });

  /** Fresh accounts carry their password; older ones get a blank line to fill in. */
  cards = computed<Card[]>(() => {
    const passwords = new Map(this.fresh.filter((r) => r.account).map((r) => [r.account!.uid, r.password ?? null]));
    const list = this.accounts().map((a) => ({ name: a.name, username: a.username, password: passwords.get(a.uid) ?? null }));
    return this.onlyFresh() ? list.filter((c) => c.password) : list;
  });
  hasFresh = computed(() => this.fresh.some((r) => r.password));
  onlyFresh = computed(() => this.hasFresh());
  pages = computed(() => {
    const out: Card[][] = [];
    const list = this.cards();
    for (let i = 0; i < list.length; i += 8) out.push(list.slice(i, i + 8));
    return out;
  });

  print() {
    window.print();
  }
}
