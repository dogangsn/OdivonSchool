import { Component, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { FirestoreService } from '../../../core/services/firestore';
import { AuthService } from '../../../core/services/auth';
import { GuestQuotaService } from '../../../core/services/guest-quota';
import { EducationLevel } from '../../../models/test-category';

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

  categories = toSignal(
    toObservable(this.level).pipe(
      switchMap((level) => this.firestoreSvc.categoriesByLevel(level))
    ),
    { initialValue: [] }
  );

  activeMeta = computed(() =>
    this.levelsMeta.find((m) => m.id === this.level()) ?? this.levelsMeta[1]
  );

  selectLevel(level: EducationLevel) {
    this.level.set(level);
  }
}
