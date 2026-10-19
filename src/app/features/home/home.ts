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

  readonly tools = [
    {
      emoji: '📒',
      title: 'Defter Notları',
      description: 'Her temanın deftere yazılacak konu özeti, tahta modu ve konu testi.',
      link: '/defter-notlari',
      cta: 'Notlara göz at',
      tone: 'tone-amber',
    },
    {
      emoji: '📚',
      title: 'Akıllı Kütüphane',
      description: 'MEB ders kitapları; kaldığın sayfadan devam et, sayfanın üstüne çiz.',
      link: '/kutuphane',
      cta: 'Kitapları aç',
      tone: 'tone-sky',
    },
    {
      emoji: '🧰',
      title: 'Sınıf Araçları',
      description: 'Şans çarkı, geri sayım, kaç ders kaldı, grup oluşturucu, kelime avı.',
      link: '/araclar',
      cta: 'Araçları kullan',
      tone: 'tone-indigo',
    },
    {
      emoji: '🐛',
      title: 'Okuma Kurdu',
      description: 'Okunan her kitap Türkiye haritasında bir il açar; sınıfça haritayı doldurun.',
      link: '/okuma-kurdu',
      cta: 'Kitap ekle',
      tone: 'tone-emerald',
    },
    {
      emoji: '🎤',
      title: 'Sesli Okuma ve Günün Okuması',
      description: 'Göz ısınması, sesli okuma, hız ve anlama ölçümüyle günlük okuma rutini.',
      link: '/okuma/gunun-okumasi',
      cta: 'Okumaya başla',
      tone: 'tone-pink',
    },
    {
      emoji: '🎯',
      title: 'Dikkat Oyunları',
      description: 'Dikkat Radarı ve Dinle ve Uygula ile seçici ve işitsel dikkat çalışması.',
      link: '/oyunlar',
      cta: 'Oyunlara git',
      tone: 'tone-purple',
    },
    {
      emoji: '🗂️',
      title: 'Evraklar',
      description: 'Müfredattan otomatik yıllık plan; Word olarak indir veya yazdır.',
      link: '/evraklar',
      cta: 'Plan oluştur',
      tone: 'tone-slate',
    },
    {
      emoji: '🏆',
      title: 'Canlı Yarışma ve Düello',
      description: 'Sınıfça canlı bilgi yarışması, arkadaşınla linkle düello.',
      link: '/oyunlar',
      cta: 'Yarışmaya katıl',
      tone: 'tone-rose',
    },
  ];

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
