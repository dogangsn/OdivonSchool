import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/services/auth';

/**
 * Öğretmen paneli giriş sayfası. Sınıf oluşturma, içerik editörü ve ödevler
 * bir sonraki aşamada buraya eklenecek (bkz. planlama/oyunlastirma-ve-ogretmen-plani.md, Faz 3).
 */
@Component({
  selector: 'app-teacher-home',
  imports: [RouterLink],
  templateUrl: './teacher-home.html',
  styleUrl: './teacher-home.scss',
})
export class TeacherHome {
  private auth = inject(AuthService);
  appUser = toSignal(this.auth.appUser$, { initialValue: null });

  readonly upcoming = [
    { emoji: '🏫', title: 'Sınıf oluştur', text: 'Sınıfını kur, 6 haneli kodla öğrencilerini davet et.' },
    { emoji: '✍️', title: 'Kendi içeriğin', text: 'Kendi sorularını, eşleştirme setlerini ve Hız Turu ayarlarını gir.' },
    { emoji: '📝', title: 'Ödev ve test', text: 'Teslim tarihli ödevler ver, sonuçları otomatik topla.' },
    { emoji: '🏁', title: 'Canlı yarışma', text: 'Sınıfta öğrencilerini projeksiyonda birbiriyle yarıştır.' },
    { emoji: '📊', title: 'Öğrenci takibi', text: 'Kim ne çalıştı, hangi kazanımda zorlanıyor, tek ekranda gör.' },
  ];
}
