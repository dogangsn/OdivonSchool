import { Component, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { FirestoreService } from '../../../core/services/firestore';
import { AuthService } from '../../../core/services/auth';
import { GuestQuotaService } from '../../../core/services/guest-quota';
import { EducationLevel, LEVEL_GRADES, TestCategory } from '../../../models/test-category';

interface LevelMeta {
  id: EducationLevel;
  title: string;
  subtitle: string;
  badge: string;
  icon: string;
}

@Component({
  selector: 'app-category-select',
  imports: [RouterLink],
  templateUrl: './category-select.html',
  styleUrl: './category-select.scss',
})
export class CategorySelect {
  private firestoreSvc = inject(FirestoreService);
  private auth = inject(AuthService);
  guestQuota = inject(GuestQuotaService);

  appUser = toSignal(this.auth.appUser$, { initialValue: null });

  constructor() {
    this.auth.appUser$.subscribe((user) => {
      if (user?.gradeLevel) {
        this.level.set(user.gradeLevel);
        this.grade.set(user.grade && LEVEL_GRADES[user.gradeLevel].includes(user.grade) ? user.grade : null);
      }
    });
  }

  levelsMeta: LevelMeta[] = [
    {
      id: 'ilkokul',
      title: 'İlkokul',
      subtitle: '1, 2, 3 ve 4. Sınıflar',
      badge: 'Temel Eğitim',
      icon: '🌱',
    },
    {
      id: 'ortaokul',
      title: 'Ortaokul',
      subtitle: '5, 6, 7 ve 8. Sınıf LGS Hazırlık',
      badge: 'LGS Odaklı',
      icon: '🎒',
    },
    {
      id: 'lise',
      title: 'Lise',
      subtitle: '9, 10, 11, 12 ve YKS / TYT-AYT',
      badge: 'YKS / Üniversite',
      icon: '🏛️',
    },
    {
      id: 'kpss',
      title: 'KPSS',
      subtitle: 'Genel Yetenek & Genel Kültür',
      badge: 'Memurluk / Kariyer',
      icon: '💼',
    },
  ];

  level = signal<EducationLevel>('ortaokul');
  /** Selected sınıf; null shows every grade of the level. */
  grade = signal<number | null>(null);

  grades = computed(() => LEVEL_GRADES[this.level()]);

  private levelCategories = toSignal(
    toObservable(this.level).pipe(
      switchMap((level) => this.firestoreSvc.categoriesByLevel(level))
    ),
    { initialValue: [] }
  );

  /**
   * Categories of the level filtered by sınıf. Categories without a `grades` field
   * show in every grade; an empty list means "only under Tüm Sınıflar".
   */
  categories = computed(() => {
    const g = this.grade();
    const list = this.levelCategories();
    if (g === null) return list;
    return list.filter((c) => !c.grades || c.grades.includes(g));
  });

  /** Categories grouped by ders, keeping the catalog order. */
  subjectGroups = computed(() => {
    const groups = new Map<string, TestCategory[]>();
    for (const c of this.categories()) {
      const list = groups.get(c.subject) ?? [];
      list.push(c);
      groups.set(c.subject, list);
    }
    return [...groups].map(([subject, items]) => ({ subject, items }));
  });

  activeMeta = computed(() =>
    this.levelsMeta.find((m) => m.id === this.level()) ?? this.levelsMeta[1]
  );

  selectLevel(level: EducationLevel) {
    if (level !== this.level()) this.grade.set(null);
    this.level.set(level);
  }

  selectGrade(grade: number | null) {
    this.grade.set(grade);
  }

  gradeLabel(c: TestCategory): string {
    if (!c.grades?.length) return `Konu #${c.order}`;
    if (c.grades.length === 1) return `${c.grades[0]}. Sınıf`;
    return `${c.grades[0]}-${c.grades[c.grades.length - 1]}. Sınıf`;
  }
}
