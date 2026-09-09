# OdivonSchool

Angular + Firebase ile İlkokul / Ortaokul / Lise / KPSS test çözme platformu.

> 📖 **Detaylı İşlemler & Operasyon Rehberi:** Projenin tüm kurulum, AI soru üretimi, CLI araçları, admin paneli ve veritabanı işlemlerinin adım adım anlatımı için [md/proje_islemleri_rehberi.md](md/proje_islemleri_rehberi.md) dosyasını inceleyin.

## Bu iskelette neler var

- **Auth**: E-posta/şifre ile giriş-kayıt (`src/app/features/auth`)
- **Kullanıcı Paneli** (`/panel`): Dashboard (özet istatistik), test geçmişi, kategori seçimi, test çözme ve sonuç ekranı
- **Admin Paneli**: gizli path `/y0n3t1m-9f3a2` altında (`src/app/app.routes.ts` içinde değiştirin) — tüm aboneler, genel istatistikler, abone detayı
- **Veri modeli**: `src/app/models/*.ts` — `AppUser`, `Subscription`, `TestCategory`, `Question`, `TestAttempt`
- **Firestore erişim katmanı**: `src/app/core/services/firestore.ts`
- **Auth servisi**: `src/app/core/services/auth.ts`
- **Test oturumu (signals ile)**: `src/app/core/services/test-session.ts`
- **Route guard'ları**: `src/app/core/guards/auth-guard.ts`, `admin-guard.ts`
- **Firestore güvenlik kuralları**: `firestore.rules` (proje köküne kopyalayıp `firebase deploy --only firestore:rules` ile yayınlayın)
- **Cloud Functions** (`functions/`):
  - `generateQuestions` — admin çağırır, Gemini API ile taslak (`reviewStatus: 'draft'`) soru üretir
  - `reviewQuestion` — admin taslağı onaylar/reddeder
  - `setUserRole` — admin başka bir kullanıcıyı admin yapabilir (ilk admin'i Firestore konsolundan elle atayın)
  - Admin panelinde `/y0n3t1m-9f3a2/sorular` sayfası bu fonksiyonları çağırıyor
- **Seed script** (`scripts/`): `categories.js` (İlkokul/Orta/Lise/KPSS ders-konu kataloğu) ve `questions.js` (birkaç kategori için elle yazılmış örnek soru) içerir; `seed.js` bunları Firestore'a yazar

## Kurulum

1. Firebase Console'da yeni proje oluşturun, Authentication (Email/Password) ve Firestore'u etkinleştirin.
2. `src/environments/environment.ts` ve `environment.production.ts` dosyalarındaki `firebase` config bilgilerini kendi projenizle değiştirin.
3. `npm install`
4. `npm start` (dev sunucusu) veya `npx ng build` (production build)
5. İlk admin kullanıcınızı Firestore konsolunda `users/{uid}` dokümanında `role: "admin"` yaparak elle atayın.
6. Cloud Functions için: `cd functions && npm install`, ardından Gemini API anahtarınızı ayarlayın:
   `firebase functions:secrets:set GEMINI_API_KEY`
   (anahtarı https://aistudio.google.com/apikey adresinden ücretsiz alabilirsiniz)
7. `firebase deploy --only functions,firestore:rules,firestore:indexes`
8. Kategori ve örnek soru verisi için:
   - Firebase Console > Project settings > Service accounts'tan yeni bir private key indirip `scripts/serviceAccountKey.json` olarak kaydedin (bu dosya `.gitignore`'da, asla commit etmeyin)
   - `cd scripts && npm install && node seed.js`
   - Bu, 17 kategori (4 seviye × birkaç ders/konu) ve birkaç kategoriye örnek onaylı soru ekler; script tekrar çalıştırılırsa kategorileri günceller, aynı soruyu tekrar eklemez

## Tamamlanan Özellikler & Altyapı

- **Ana Sayfa (Landing Page):** İnteraktif soru önizlemeli, 4 kademe tanıtımlı ve dönüşüm odaklı karşılama sayfası (`src/app/features/home`).
- **Öğrenci Profili & Ayarlar:** Sınıf seviyesi, isim ve şifre yönetimi (`src/app/features/user-panel/profile`).
- **Admin Panelinde Yetki & Abonelik Yönetimi:** Tek tıkla Admin yetkisi verme veya Pro/VIP abonelik tanımlama (`/y0n3t1m-9f3a2/aboneler/:userId`).
- **İnteraktif Ödeme & Aktivasyon Modalı:** `/fiyatlandirma` sayfasından anında Pro üyeliği aktive eden güvenli ödeme penceresi.
- **Pedagojik Test Çözümü:** "Pas Geç / Boş Bırak" ve doğru yanıtlarda da "Çözüm Açıklamasını Gör" kontrolleri.
- **Yapay Zekâ ile Otomatik Soru Üretimi:** Admin panelinden veya `scripts/batch-generate-all.js` CLI aracıyla 77 kategorinin tamamına Google Gemini 2.0 Flash ile soru üretimi.

