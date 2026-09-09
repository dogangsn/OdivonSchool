import { Component, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FirestoreService } from '../../../core/services/firestore';

@Component({
  selector: 'app-subscriber-list',
  imports: [RouterLink],
  templateUrl: './subscriber-list.html',
  styleUrl: './subscriber-list.scss',
})
export class SubscriberList {
  private firestoreSvc = inject(FirestoreService);

  users = toSignal(this.firestoreSvc.allUsers(), { initialValue: [] });

  search = signal('');

  filteredUsers = computed(() => {
    const term = this.search().toLowerCase().trim();
    if (!term) return this.users();
    return this.users().filter(
      (u) => u.displayName.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)
    );
  });
}
