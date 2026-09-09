import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private auth = inject(AuthService);
  appUser = toSignal(this.auth.appUser$, { initialValue: null });

  // Interactive Demo Question State
  selectedDemoOption = signal<string | null>(null);
  showDemoExplanation = signal<boolean>(false);

  demoQuestion = {
    subject: 'LGS Matematik',
    topic: 'Çarpanlar ve Katlar (EBOB - EKOK)',
    prompt:
      'Kenar uzunlukları 48 metre ve 60 metre olan dikdörtgen biçimindeki bir tarlanın etrafına, köşelere de gelmek şartıyla eşit aralıklarla fidan dikilecektir. Bu iş için en az kaç fidan gereklidir?',
    options: [
      { id: 'a', text: '16' },
      { id: 'b', text: '18' },
      { id: 'c', text: '20' },
      { id: 'd', text: '24' },
    ],
    correctOptionId: 'b',
    explanation:
      'Aralıkların en büyük olması için 48 ve 60 sayılarının En Büyük Ortak Böleni (EBOB) bulunur. EBOB(48, 60) = 12 metredir. Tarlanın çevre uzunluğu = 2 × (48 + 60) = 216 metredir. Gerekli minimum fidan sayısı = Çevre / Aralık = 216 / 12 = 18 fidandır.',
  };

  selectDemoOption(id: string) {
    this.selectedDemoOption.set(id);
    this.showDemoExplanation.set(true);
  }

  resetDemo() {
    this.selectedDemoOption.set(null);
    this.showDemoExplanation.set(false);
  }
}
