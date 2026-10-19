import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
} from '@angular/fire/firestore';
import { EducationLevel } from '../../models/test-category';
import { environment } from '../../../environments/environment';

/** One MEB ders kitabı from /kutuphane/kitaplar.json. */
export interface LibraryBook {
  /** MEB's own book id on tymm.meb.gov.tr (also our route id). */
  id: number;
  title: string;
  level: EducationLevel;
  grade: number;
  subject: string;
  volume: number | null;
  /** Official MEB book page. */
  pageUrl: string;
  /** Official MEB PDF. */
  pdfUrl: string | null;
  interactiveUrl: string | null;
}

/** users/{uid}/library/{bookId}: where the reader left off. */
export interface BookProgress {
  bookId: number;
  page: number;
  pageCount: number;
  updatedAt: number;
}

const LOCAL_KEY = 'odivon.library.progress';

/**
 * Akıllı Kütüphane. Books stay on MEB's servers (tymm.meb.gov.tr); we keep
 * only the catalog. Progress is saved per user in Firestore so "kaldığın
 * sayfadan devam" works across devices, and in localStorage for guests.
 */
@Injectable({ providedIn: 'root' })
export class LibraryService {
  private firestore = inject(Firestore);
  private catalogPromise: Promise<LibraryBook[]> | null = null;

  catalog(): Promise<LibraryBook[]> {
    this.catalogPromise ??= fetch('/kutuphane/kitaplar.json')
      .then((res) => {
        if (!res.ok) throw new Error(`kitaplar.json: ${res.status}`);
        return res.json() as Promise<LibraryBook[]>;
      })
      .catch((err) => {
        this.catalogPromise = null;
        throw err;
      });
    return this.catalogPromise;
  }

  async book(id: number): Promise<LibraryBook | null> {
    return (await this.catalog()).find((b) => b.id === id) ?? null;
  }

  /**
   * PDF sources to try, in order: MEB's own link, then the optional
   * kitapPdf proxy (functions/src/bookProxy.ts) for browsers that MEB's
   * server refuses cross-site.
   */
  pdfSources(book: LibraryBook): string[] {
    if (!book.pdfUrl) return [];
    const sources = [book.pdfUrl];
    const proxy = environment.libraryProxyUrl;
    if (proxy) sources.push(`${proxy}?url=${encodeURIComponent(book.pdfUrl)}`);
    return sources;
  }

  // ---- Progress ----

  async progress(uid: string | null, bookId: number): Promise<BookProgress | null> {
    const local = this.localAll()[bookId] ?? null;
    if (!uid) return local;
    try {
      const snap = await getDoc(doc(this.firestore, `users/${uid}/library/${bookId}`));
      const remote = snap.exists() ? (snap.data() as BookProgress) : null;
      if (!remote) return local;
      return local && local.updatedAt > remote.updatedAt ? local : remote;
    } catch {
      return local;
    }
  }

  async recent(uid: string | null, max = 6): Promise<BookProgress[]> {
    const local = Object.values(this.localAll());
    let remote: BookProgress[] = [];
    if (uid) {
      try {
        const q = query(collection(this.firestore, `users/${uid}/library`), orderBy('updatedAt', 'desc'), limit(max));
        remote = (await getDocs(q)).docs.map((d) => d.data() as BookProgress);
      } catch {
        remote = [];
      }
    }
    const merged = new Map<number, BookProgress>();
    for (const p of [...remote, ...local]) {
      const prev = merged.get(p.bookId);
      if (!prev || p.updatedAt > prev.updatedAt) merged.set(p.bookId, p);
    }
    return [...merged.values()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, max);
  }

  async saveProgress(uid: string | null, progress: BookProgress): Promise<void> {
    const all = this.localAll();
    all[progress.bookId] = progress;
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
    } catch {
      // Private mode or full storage: Firestore (if signed in) still has it.
    }
    if (!uid) return;
    try {
      await setDoc(doc(this.firestore, `users/${uid}/library/${progress.bookId}`), progress);
    } catch (err) {
      console.warn('[Library] progress not saved:', err);
    }
  }

  private localAll(): Record<number, BookProgress> {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
    } catch {
      return {};
    }
  }
}
