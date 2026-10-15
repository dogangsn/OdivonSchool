import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  deleteDoc,
  doc,
  query,
  setDoc,
  where,
} from '@angular/fire/firestore';
import { Observable, catchError, combineLatest, map, of } from 'rxjs';
import { AppUser } from '../../models/user';
import { AUDIENCE_ALL, ClassMessage } from '../../models/duel';
import { Classroom } from '../../models/classroom';

export const MESSAGE_MAX_LENGTH = 1000;

/** Teacher → students notes inside a class. */
@Injectable({ providedIn: 'root' })
export class ClassMessageService {
  private firestore = inject(Firestore);

  /** Everything the teacher sent in a class, newest first. */
  sent(classId: string): Observable<ClassMessage[]> {
    return (
      collectionData(collection(this.firestore, `classes/${classId}/messages`), { idField: 'id' }) as Observable<
        ClassMessage[]
      >
    ).pipe(
      map(newestFirst),
      catchError(() => of([]))
    );
  }

  /** Messages a student may read in one class: to everyone or to them. */
  forStudent(classId: string, uid: string): Observable<ClassMessage[]> {
    const col = collection(this.firestore, `classes/${classId}/messages`);
    const read = (value: string) =>
      (collectionData(query(col, where('audience', 'array-contains', value)), { idField: 'id' }) as Observable<
        ClassMessage[]
      >).pipe(catchError(() => of([] as ClassMessage[])));
    return combineLatest([read(AUDIENCE_ALL), read(uid)]).pipe(
      map(([all, mine]) => {
        const byId = new Map<string, ClassMessage>();
        for (const m of [...all, ...mine]) byId.set(m.id, m);
        return newestFirst([...byId.values()]);
      })
    );
  }

  /** Every class's messages for a student, newest first. */
  forStudentClasses(classes: Classroom[], uid: string): Observable<ClassMessage[]> {
    if (classes.length === 0) return of([]);
    return combineLatest(classes.map((c) => this.forStudent(c.id, uid))).pipe(
      map((groups) => newestFirst(groups.flat()))
    );
  }

  async send(
    classId: string,
    teacher: AppUser,
    text: string,
    audience: string[],
    link: { path: string; label: string } | null = null
  ): Promise<string> {
    const ref = doc(collection(this.firestore, `classes/${classId}/messages`));
    const message: Omit<ClassMessage, 'id'> = {
      classId,
      teacherId: teacher.uid,
      teacherName: (teacher.displayName || 'Öğretmen').slice(0, 80),
      text: text.trim().slice(0, MESSAGE_MAX_LENGTH),
      audience: audience.length ? audience : [AUDIENCE_ALL],
      link: link?.path ?? null,
      linkLabel: link?.label.slice(0, 60) ?? null,
      createdAt: Date.now(),
    };
    await setDoc(ref, message);
    return ref.id;
  }

  async remove(classId: string, messageId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, `classes/${classId}/messages/${messageId}`));
  }
}

function newestFirst(list: ClassMessage[]): ClassMessage[] {
  return [...list].sort((a, b) => b.createdAt - a.createdAt);
}
