import { Component, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/services/auth';

interface PricingPlan {
  id: string;
  name: string;
  badge?: string;
  isPopular?: boolean;
  desc: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  ctaText: string;
  ctaClass: string;
}

@Component({
  selector: 'app-pricing',
  imports: [RouterLink],
  templateUrl: './pricing.html',
  styleUrl: './pricing.scss',
})
export class Pricing {
  private auth = inject(AuthService);
  appUser = toSignal(this.auth.appUser$, { initialValue: null });

  isYearly = signal(true);
  Math = Math;

  plans: PricingPlan[] = [
    {
      id: 'free',
      name: 'Ücretsiz Deneme',
      desc: 'OdivonSchool sistemini keşfetmek ve soru kalitesini görmek isteyen öğrenciler için.',
      monthlyPrice: 0,
      yearlyPrice: 0,
      features: [
        '5 Ücretsiz Test Hakkı',
        'Tüm Kademelere Erişim (İlkokul, Ortaokul, Lise, KPSS)',
        'Temel Soru Çözüm Açıklamaları',
        'Anlık Test Başarı Karnesi',
        'Mobil ve Masaüstü Uyumlu',
      ],
      ctaText: 'Hemen Ücretsiz Başla',
      ctaClass: 'outline',
    },
    {
      id: 'pro',
      name: 'Pro Öğrenci',
      badge: 'En Popüler 🌟',
      isPopular: true,
      desc: 'Düzenli pratik yapmak, konu eksiklerini kapatmak ve netlerini hızla artırmak isteyenler için.',
      monthlyPrice: 99,
      yearlyPrice: 790,
      features: [
        'Sınırsız Test Çözme (Tüm Dersler & Konular)',
        'Yapay Zekâ Destekli Adım Adım Soru Çözümleri',
        'Detaylı Zayıf Konu & Başarı Analitiği',
        'Haftalık Yeni Nesil MEB / ÖSYM Soruları',
        'Tüm Test Geçmişini Kalıcı Kaydetme',
        'Reklamsız & Kesintisiz Çalışma',
      ],
      ctaText: 'Pro ile Başarıya Ulaş',
      ctaClass: 'primary',
    },
    {
      id: 'vip',
      name: 'VIP Sınav Hazırlık',
      badge: 'Derece Hedefleyenler 👑',
      isPopular: false,
      desc: 'LGS, YKS veya KPSS sınavlarında yüksek derece ve hedefine kesin ulaşmak isteyenler için.',
      monthlyPrice: 199,
      yearlyPrice: 1490,
      features: [
        'Pro Paketteki Tüm Özellikler',
        'Türkiye Geneli Canlı Deneme Sınavları & Sıralama',
        'Akıllı Soru Tekrarı (Yanlış yaptığın sorulardan özel testler)',
        'Kişiselleştirilmiş Eksik Kapatma Çalışma Programı',
        'Veli & Öğretmen PDF Performans Raporları',
        'Öncelikli 7/24 Öğrenci Destek Hattı',
      ],
      ctaText: 'VIP Avantajla Başla',
      ctaClass: 'accent',
    },
  ];

  faqs = [
    {
      q: 'Ücretsiz deneme için kredi kartı gerekiyor mu?',
      a: 'Hayır, kesinlikle gerekmez. Kayıt olmadan doğrudan 5 test çözebilir veya ücretsiz hesap açarak platformu deneyebilirsiniz.',
      isOpen: signal(false),
    },
    {
      q: 'İstediğim zaman aboneliğimi iptal edebilir miyim?',
      a: 'Evet, hiçbir taahhüt bulunmamaktadır. Profilinizden tek tıkla aboneliğinizi dilediğiniz an iptal edebilirsiniz.',
      isOpen: signal(false),
    },
    {
      q: 'Sorular güncel MEB ve ÖSYM müfredatına uygun mu?',
      a: 'Evet. Soru havuzumuz düzenli olarak alanında uzman öğretmenler ve Gemini AI destekli soru inceleme paneliyle güncel müfredata göre denetlenir.',
      isOpen: signal(false),
    },
    {
      q: 'Birden fazla kademedeki testleri çözebilir miyim?',
      a: 'Evet. Pro veya VIP üyelikle İlkokul, Ortaokul, Lise ve KPSS testlerinin tamamına sınırsız erişebilirsiniz.',
      isOpen: signal(false),
    },
  ];

  toggleCycle(yearly: boolean) {
    this.isYearly.set(yearly);
  }

  toggleFaq(index: number) {
    this.faqs[index].isOpen.update((v) => !v);
  }
}
