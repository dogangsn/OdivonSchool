import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Functions, httpsCallable } from '@angular/fire/functions';
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
  imports: [RouterLink, FormsModule],
  templateUrl: './pricing.html',
  styleUrl: './pricing.scss',
})
export class Pricing {
  private auth = inject(AuthService);
  private functions = inject(Functions);
  private sanitizer = inject(DomSanitizer);
  private router = inject(Router);

  appUser = toSignal(this.auth.appUser$, { initialValue: null });

  isYearly = signal(true);
  Math = Math;

  // Checkout modal: our form only asks for a phone number (PayTR requires
  // one); card details are typed into PayTR's own iframe.
  selectedPlanForCheckout = signal<PricingPlan | null>(null);
  checkoutStep = signal<'form' | 'processing' | 'paytr' | 'success'>('form');
  phone = signal('');
  checkoutError = signal<string | null>(null);
  paytrUrl = signal<SafeResourceUrl | null>(null);
  private merchantOid: string | null = null;

  constructor() {
    // PayTR tells our server, the server writes users/{uid}; the live user
    // doc then flips the modal to the success screen.
    effect(() => {
      const u = this.appUser();
      if (this.merchantOid && u?.subscriptionId === this.merchantOid && u.subscriptionStatus === 'active') {
        this.merchantOid = null;
        this.paytrUrl.set(null);
        this.checkoutStep.set('success');
      }
    });
  }

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
      q: 'Üyeliğim otomatik yenilenir mi?',
      a: 'Hayır. Ödemeler tek seferliktir ve kartınızdan tekrar çekim yapılmaz. Süreniz bitince dilediğiniz paketi yeniden alabilirsiniz; süre bitmeden alırsanız yeni süre kalan sürenizin üzerine eklenir.',
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

  openCheckout(plan: PricingPlan) {
    if (plan.monthlyPrice === 0) {
      if (this.appUser()) {
        this.router.navigate(['/panel/kategoriler']);
      } else {
        this.router.navigate(['/kategoriler']);
      }
      return;
    }

    if (!this.appUser()) {
      this.router.navigate(['/kayit']);
      return;
    }

    this.selectedPlanForCheckout.set(plan);
    this.checkoutStep.set('form');
    this.checkoutError.set(null);
    this.paytrUrl.set(null);
  }

  closeCheckout() {
    this.selectedPlanForCheckout.set(null);
    this.checkoutStep.set('form');
    this.paytrUrl.set(null);
    this.merchantOid = null;
  }

  async processPayment() {
    const plan = this.selectedPlanForCheckout();
    if (!plan || !this.appUser()) return;

    const phone = this.phone().replace(/[^\d+]/g, '');
    if (phone.replace(/\D/g, '').length < 10) {
      this.checkoutError.set('Lütfen geçerli bir cep telefonu numarası girin (ör. 05xx xxx xx xx).');
      return;
    }

    this.checkoutError.set(null);
    this.checkoutStep.set('processing');
    try {
      const start = httpsCallable<
        { plan: string; period: string; phone: string },
        { token: string; merchantOid: string }
      >(this.functions, 'paytrStart');
      const res = await start({ plan: plan.id, period: this.isYearly() ? 'yearly' : 'monthly', phone });
      this.merchantOid = res.data.merchantOid;
      this.paytrUrl.set(
        this.sanitizer.bypassSecurityTrustResourceUrl(
          `https://www.paytr.com/odeme/guvenli/${encodeURIComponent(res.data.token)}`
        )
      );
      this.checkoutStep.set('paytr');
    } catch (err: any) {
      this.checkoutStep.set('form');
      const code = String(err?.code ?? '').replace('functions/', '');
      this.checkoutError.set(
        code === 'invalid-argument' || code === 'unavailable' || code === 'permission-denied'
          ? err.message
          : code === 'failed-precondition' && !/PayTR/.test(err?.message ?? '')
            ? err.message
            : 'Online ödeme altyapımız çok yakında aktif olacak. Pro üyelik için lütfen bizimle iletişime geçin.'
      );
    }
  }
}
