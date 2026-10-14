import { Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NotificationService } from '../../../core/services/notifications';

/** Header bell: new questions in the student's sınıf since they last looked. */
@Component({
  selector: 'app-notification-bell',
  imports: [RouterLink, DatePipe],
  templateUrl: './notification-bell.html',
  styleUrl: './notification-bell.scss',
})
export class NotificationBell {
  notifications = inject(NotificationService);
  private host = inject(ElementRef<HTMLElement>);

  open = signal(false);

  toggle() {
    const next = !this.open();
    this.open.set(next);
    if (!next) this.markSeen();
  }

  close() {
    if (!this.open()) return;
    this.open.set(false);
    this.markSeen();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent) {
    if (!this.host.nativeElement.contains(e.target as Node)) this.close();
  }

  private markSeen() {
    this.notifications.markAllSeen().catch((err) => console.warn('[NotificationBell] markAllSeen failed:', err));
  }
}
