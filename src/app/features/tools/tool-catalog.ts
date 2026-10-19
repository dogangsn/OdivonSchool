export interface ToolDef {
  id: string;
  emoji: string;
  title: string;
  description: string;
  link: string;
  category: 'yonetim' | 'zaman' | 'okuma' | 'etkinlik';
}

export const TOOL_CATEGORIES: { id: ToolDef['category']; title: string }[] = [
  { id: 'yonetim', title: 'Sınıf Yönetimi' },
  { id: 'zaman', title: 'Zaman' },
  { id: 'okuma', title: 'Okuma ve Dikkat' },
  { id: 'etkinlik', title: 'Etkinlik Üreticileri' },
];

export const TOOLS: ToolDef[] = [
  {
    id: 'sans-carki',
    emoji: '🎡',
    title: 'Şans Çarkı',
    description: 'Sınıf listenden rastgele öğrenci seç; seçileni çarktan çıkarabilirsin.',
    link: '/araclar/sans-carki',
    category: 'yonetim',
  },
  {
    id: 'grup',
    emoji: '👥',
    title: 'Grup Oluşturucu',
    description: 'Sınıfı tek tıkla eşit gruplara ayır, takım adlarıyla tahtaya yansıt.',
    link: '/araclar/grup',
    category: 'yonetim',
  },
  {
    id: 'geri-sayim',
    emoji: '⏱️',
    title: 'Geri Sayım ve Kronometre',
    description: 'Etkinlik süresi için büyük ekran geri sayım, bitince sesli uyarı.',
    link: '/araclar/geri-sayim',
    category: 'zaman',
  },
  {
    id: 'kac-ders-kaldi',
    emoji: '🔔',
    title: 'Öğretmenim Kaç Ders Kaldı?',
    description: 'Ders programına göre şu anki ders, teneffüse kalan süre ve kalan ders sayısı.',
    link: '/araclar/kac-ders-kaldi',
    category: 'zaman',
  },
  {
    id: 'goz-jimnastigi',
    emoji: '👀',
    title: 'Göz Jimnastiği',
    description: 'Okuma öncesi göz ısınması: yatay, dikey, Z, sonsuzluk ve çevresel takip.',
    link: '/araclar/goz-jimnastigi',
    category: 'okuma',
  },
  {
    id: 'okuma-kurdu',
    emoji: '🐛',
    title: 'Okuma Kurdu',
    description: 'Okunan kitapları kaydet, Kitaplarla Türkiye haritasında il aç.',
    link: '/okuma-kurdu',
    category: 'okuma',
  },
  {
    id: 'kelime-avi',
    emoji: '🔤',
    title: 'Kelime Avı Tasarla',
    description: 'Kelimelerini yaz, bulmacayı oluştur, cevap anahtarıyla yazdır veya PDF kaydet.',
    link: '/araclar/kelime-avi',
    category: 'etkinlik',
  },
  {
    id: 'yillik-plan',
    emoji: '🗂️',
    title: 'Yıllık Plan',
    description: 'Müfredattan haftalara dağıtılmış yıllık plan; Word olarak indir.',
    link: '/evraklar',
    category: 'etkinlik',
  },
];
