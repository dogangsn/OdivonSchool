import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  getDoc,
  orderBy,
  query,
  setDoc,
} from '@angular/fire/firestore';
import { Observable, catchError, of } from 'rxjs';

export const NOTE_COLORS = ['sari', 'mavi', 'yesil', 'pembe', 'mor'] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

export const NOTE_LIMITS = { title: 120, subject: 60, body: 20000 };

/** users/{uid}/notes/{id}: a note the student or teacher wrote themselves. */
export interface MyNote {
  id: string;
  title: string;
  subject: string;
  /** Sınıf 1-12, or null when the note is not tied to one. */
  grade: number | null;
  body: string;
  color: NoteColor;
  /** Defter Notları tema the note was started from, if any. */
  linkedSlug: string | null;
  createdAt: number;
  updatedAt: number;
}

export type MyNoteDraft = Omit<MyNote, 'id' | 'createdAt' | 'updatedAt'>;

/** One rendered piece of a note body. */
export type NoteBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'remember'; text: string }
  | { kind: 'text'; text: string };

/**
 * Turns the plain text a person typed into notebook blocks:
 * "# Başlık" -> heading, "- madde" / "* madde" -> list, "! not" -> Akılda Kalsın
 * box, and every other run of lines -> a paragraph.
 */
export function parseNoteBody(body: string): NoteBlock[] {
  const blocks: NoteBlock[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: 'text', text: para.join('\n') });
    para = [];
  };
  for (const raw of body.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    const heading = /^#{1,3}\s+(.*)$/.exec(line);
    const item = /^[-*•](?:\s+(.*))?$/.exec(line);
    const remember = /^!\s*(.*)$/.exec(line);
    if (!line) {
      flush();
    } else if (heading) {
      flush();
      blocks.push({ kind: 'heading', text: heading[1] });
    } else if (item) {
      flush();
      const last = blocks[blocks.length - 1];
      const text = item[1] ?? '';
      if (last?.kind === 'list') last.items.push(text);
      else blocks.push({ kind: 'list', items: [text] });
    } else if (remember && remember[1]) {
      flush();
      blocks.push({ kind: 'remember', text: remember[1] });
    } else {
      para.push(line);
    }
  }
  flush();
  return blocks;
}

/** Trims and clamps a draft to what the Firestore rules accept. */
export function cleanDraft(d: MyNoteDraft): MyNoteDraft {
  const grade = typeof d.grade === 'number' && d.grade >= 1 && d.grade <= 12 ? Math.round(d.grade) : null;
  return {
    title: d.title.trim().slice(0, NOTE_LIMITS.title),
    subject: d.subject.trim().slice(0, NOTE_LIMITS.subject),
    grade,
    body: d.body.slice(0, NOTE_LIMITS.body),
    color: NOTE_COLORS.includes(d.color) ? d.color : 'sari',
    linkedSlug: d.linkedSlug ? d.linkedSlug.slice(0, 160) : null,
  };
}

/** Notlarım: personal notes, readable and writable only by their owner. */
@Injectable({ providedIn: 'root' })
export class MyNotesService {
  private firestore = inject(Firestore);

  list(uid: string): Observable<MyNote[]> {
    const q = query(collection(this.firestore, `users/${uid}/notes`), orderBy('updatedAt', 'desc'));
    return (collectionData(q, { idField: 'id' }) as Observable<MyNote[]>).pipe(catchError(() => of([] as MyNote[])));
  }

  async get(uid: string, id: string): Promise<MyNote | null> {
    const snap = await getDoc(doc(this.firestore, `users/${uid}/notes/${id}`));
    return snap.exists() ? ({ ...(snap.data() as Omit<MyNote, 'id'>), id: snap.id } as MyNote) : null;
  }

  /** Creates the note when id is null; returns the note id. */
  async save(uid: string, id: string | null, draft: MyNoteDraft, createdAt?: number): Promise<string> {
    const now = Date.now();
    const data = { ...cleanDraft(draft), createdAt: createdAt ?? now, updatedAt: now };
    if (!id) return (await addDoc(collection(this.firestore, `users/${uid}/notes`), data)).id;
    await setDoc(doc(this.firestore, `users/${uid}/notes/${id}`), data);
    return id;
  }

  remove(uid: string, id: string): Promise<void> {
    return deleteDoc(doc(this.firestore, `users/${uid}/notes/${id}`));
  }
}
