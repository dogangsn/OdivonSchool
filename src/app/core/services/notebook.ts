import { Injectable } from '@angular/core';
import { EducationLevel } from '../../models/test-category';

/** One row of /defter/index.json (built by scripts/build-defter.js). */
export interface NoteSummary {
  slug: string;
  file: string;
  level: EducationLevel;
  grade: number;
  subject: string;
  order: number;
  title: string;
  intro: string;
  hasNote: boolean;
}

export interface NoteSection {
  title: string;
  text: string;
  points: string[];
}

export interface NoteBody {
  intro: string;
  sections: NoteSection[];
  keyTerms: { term: string; meaning: string }[];
  example: { question: string; solution: string } | null;
  remember: string[];
}

export interface NoteDetail {
  slug: string;
  level: EducationLevel;
  grade: number;
  subject: string;
  order: number;
  title: string;
  hours: number | null;
  sourceUrl: string | null;
  /** Test category of the same tema, or null when the tema has no kazanım. */
  categoryId: string | null;
  keyConcepts: string[];
  outcomes: { code: string; text: string }[];
  note: NoteBody | null;
}

/**
 * Defter Notları: static JSON served from /defter (no Firestore reads), so the
 * notes open for guests too and cache like any other asset.
 */
@Injectable({ providedIn: 'root' })
export class NotebookService {
  private indexPromise: Promise<NoteSummary[]> | null = null;
  private files = new Map<string, Promise<Record<string, NoteDetail>>>();

  index(): Promise<NoteSummary[]> {
    this.indexPromise ??= this.getJson<NoteSummary[]>('/defter/index.json').catch((err) => {
      this.indexPromise = null;
      throw err;
    });
    return this.indexPromise;
  }

  /** Every tema of one sınıf + ders, in program order (Yıllık plan). */
  async themes(grade: number, subject: string, level: EducationLevel): Promise<NoteDetail[]> {
    const rows = (await this.index()).filter((n) => n.grade === grade && n.subject === subject && n.level === level);
    const details = await Promise.all(rows.map((r) => this.note(r.slug)));
    return details.filter((d): d is NoteDetail => !!d).sort((a, b) => a.order - b.order);
  }

  async note(slug: string): Promise<NoteDetail | null> {
    const row = (await this.index()).find((n) => n.slug === slug);
    if (!row) return null;
    let file = this.files.get(row.file);
    if (!file) {
      file = this.getJson<Record<string, NoteDetail>>(`/defter/${row.file}.json`);
      this.files.set(row.file, file);
      file.catch(() => this.files.delete(row.file));
    }
    return (await file)[slug] ?? null;
  }

  private async getJson<T>(url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    return (await res.json()) as T;
  }
}
