import { Component, ElementRef, HostListener, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, filter } from 'rxjs';
import { AuthService } from '../../../core/services/auth';
import {
  MyNote,
  MyNoteDraft,
  MyNotesService,
  NOTE_COLORS,
  NOTE_LIMITS,
  NoteColor,
  parseNoteBody,
} from '../../../core/services/my-notes';
import { SUBJECT_ICONS } from '../notebook-list/notebook-list';

const COLOR_LABELS: Record<NoteColor, string> = {
  sari: 'Sarı',
  mavi: 'Mavi',
  yesil: 'Yeşil',
  pembe: 'Pembe',
  mor: 'Mor',
};

/** /defter-notlari/notlarim/:id ("yeni" for a new note): write and read your own note. */
@Component({
  selector: 'app-my-note',
  imports: [RouterLink],
  templateUrl: './my-note.html',
  styleUrls: ['../notebook-note/notebook-note.scss', './my-note.scss'],
})
export class MyNotePage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);
  private notes = inject(MyNotesService);
  private page = viewChild<ElementRef<HTMLElement>>('page');

  readonly colors = NOTE_COLORS;
  readonly colorLabels = COLOR_LABELS;
  readonly limits = NOTE_LIMITS;
  readonly grades = Array.from({ length: 12 }, (_, i) => i + 1);
  readonly subjectOptions = Object.keys(SUBJECT_ICONS);

  private uid = '';
  id = signal<string | null>(null);
  private createdAt: number | undefined;
  isTeacher = signal(false);

  title = signal('');
  subject = signal('');
  grade = signal<number | null>(null);
  body = signal('');
  color = signal<NoteColor>('sari');
  linkedSlug = signal<string | null>(null);

  loading = signal(true);
  notFound = signal(false);
  saving = signal(false);
  dirty = signal(false);
  savedAt = signal<number | null>(null);
  error = signal('');
  /** Phones show one pane at a time. */
  pane = signal<'edit' | 'view'>('edit');
  board = signal(false);

  blocks = computed(() => parseNoteBody(this.body()));
  canSave = computed(() => this.title().trim().length > 0 && !this.saving());

  constructor() {
    this.init();
  }

  private async init() {
    const user = await firstValueFrom(this.auth.appUser$.pipe(filter((u) => !!u)));
    this.uid = user!.uid;
    this.isTeacher.set(user!.role === 'teacher');
    const id = this.route.snapshot.paramMap.get('id') ?? 'yeni';
    try {
      if (id === 'yeni') {
        const q = this.route.snapshot.queryParamMap;
        this.title.set(q.get('baslik') ?? '');
        this.subject.set(q.get('ders') ?? '');
        const g = Number(q.get('sinif') ?? user!.grade ?? 0);
        this.grade.set(g >= 1 && g <= 12 ? g : null);
        this.linkedSlug.set(q.get('tema'));
        this.body.set(this.isTeacher() ? TEACHER_TEMPLATE : STUDENT_TEMPLATE);
      } else {
        const note = await this.notes.get(this.uid, id);
        if (!note) {
          this.notFound.set(true);
        } else {
          this.fill(note);
          this.pane.set('view');
        }
      }
    } catch {
      this.notFound.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  private fill(n: MyNote) {
    this.id.set(n.id);
    this.createdAt = n.createdAt;
    this.title.set(n.title);
    this.subject.set(n.subject);
    this.grade.set(n.grade);
    this.body.set(n.body);
    this.color.set(n.color);
    this.linkedSlug.set(n.linkedSlug);
    this.savedAt.set(n.updatedAt);
    document.title = `${n.title} | Notlarım | OdivonSchool`;
  }

  set<T>(field: { set(v: T): void }, value: T) {
    field.set(value);
    this.dirty.set(true);
    this.error.set('');
  }

  onText(field: 'title' | 'subject' | 'body', event: Event) {
    this.set(this[field], (event.target as HTMLInputElement | HTMLTextAreaElement).value);
  }

  onGrade(event: Event) {
    const v = Number((event.target as HTMLSelectElement).value);
    this.set(this.grade, v || null);
  }

  /** Inserts a formatting marker at the start of the caret's line. */
  insert(textarea: HTMLTextAreaElement, marker: string) {
    const value = textarea.value;
    const start = textarea.selectionStart ?? value.length;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const next = value.slice(0, lineStart) + marker + value.slice(lineStart);
    textarea.value = next;
    this.set(this.body, next);
    textarea.focus();
    const caret = start + marker.length;
    textarea.setSelectionRange(caret, caret);
  }

  async save() {
    if (!this.canSave()) {
      this.error.set('Notuna bir başlık ver.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    const draft: MyNoteDraft = {
      title: this.title(),
      subject: this.subject(),
      grade: this.grade(),
      body: this.body(),
      color: this.color(),
      linkedSlug: this.linkedSlug(),
    };
    try {
      const wasNew = !this.id();
      const id = await this.notes.save(this.uid, this.id(), draft, this.createdAt);
      this.createdAt ??= Date.now();
      this.id.set(id);
      this.dirty.set(false);
      this.savedAt.set(Date.now());
      if (wasNew) this.router.navigate(['/defter-notlari/notlarim', id], { replaceUrl: true });
    } catch (err) {
      console.error('[MyNote] save failed', err);
      this.error.set('Not kaydedilemedi. İnternet bağlantını kontrol edip tekrar dene.');
    } finally {
      this.saving.set(false);
    }
  }

  async remove() {
    const id = this.id();
    if (!id) {
      this.router.navigate(['/defter-notlari'], { queryParams: { bolum: 'notlarim' } });
      return;
    }
    if (!confirm('Bu not silinsin mi? Bu işlem geri alınamaz.')) return;
    try {
      await this.notes.remove(this.uid, id);
      this.dirty.set(false);
      this.router.navigate(['/defter-notlari'], { queryParams: { bolum: 'notlarim' } });
    } catch {
      this.error.set('Not silinemedi, tekrar dene.');
    }
  }

  print() {
    window.print();
  }

  async toggleBoard() {
    const on = !this.board();
    this.board.set(on);
    if (on) this.pane.set('view');
    const el = this.page()?.nativeElement;
    try {
      if (on && el?.requestFullscreen && !document.fullscreenElement) await el.requestFullscreen();
      if (!on && document.fullscreenElement) await document.exitFullscreen();
    } catch {
      // Full screen is optional; the larger type still applies.
    }
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange() {
    if (!document.fullscreenElement && this.board()) this.board.set(false);
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent) {
    if (this.dirty()) event.preventDefault();
  }

  icon(subject: string): string {
    return SUBJECT_ICONS[subject] ?? '✍️';
  }
}

const STUDENT_TEMPLATE = `# Konunun özeti
Kendi cümlelerinle yaz.

# Önemli noktalar
- 
- 

! Sınavdan önce unutma: `;

const TEACHER_TEMPLATE = `# Dersin amacı
Bu derste öğrenciler ...

# Anlatım
- 
- 

# Sınıfta soracağım soru
...

! Akılda kalsın: `;
