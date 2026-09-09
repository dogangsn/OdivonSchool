# OdivonSchool — Kapsamlı Proje İşlemleri ve Operasyon Rehberi

Bu belge; **OdivonSchool** platformunun mimarisini, kurulum adımlarını, yerel geliştirme süreçlerini, kullanıcı ve öğrenci akışlarını, yönetici (admin) işlemlerini, yapay zekâ destekli soru üretim motorunu, terminal CLI otomasyonlarını, Firestore veritabanı kurallarını ve canlıya dağıtım (deployment) süreçlerini eksiksiz biçimde açıklar.

---

## 📑 İçindekiler

1. [Proje Genel Tanımı ve Teknoloji Yığını](#1-proje-genel-tanımı-ve-teknoloji-yığını)
2. [Dizin ve Dosya Mimarisi](#2-dizin-ve-dosya-mimarisi)
3. [Kurulum ve Yerel Geliştirme (Local Development)](#3-kurulum-ve-yerel-geliştirme-local-development)
4. [Kullanıcı ve Öğrenci İşlemleri (User Flows)](#4-kullanıcı-ve-öğrenci-işlemleri-user-flows)
5. [Yönetici (Admin) Paneli ve Operasyonları](#5-yönetici-admin-paneli-ve-operasyonları)
6. [Yapay Zekâ (Gemini 2.0 Flash) Soru Üretim Motoru](#6-yapay-zekâ-gemini-20-flash-soru-üretim-motoru)
7. [Terminal ve CLI Script İşlemleri (Otomasyon)](#7-terminal-ve-cli-script-işlemleri-otomasyon)
8. [Veritabanı Mimarisi, Şemalar ve Güvenlik Kuralları](#8-veritabanı-mimarisi-şemalar-ve-güvenlik-kuralları)
9. [Canlıya Alma ve Dağıtım (Deployment)](#9-canlıya-alma-ve-dağıtım-deployment)
10. [Sık Karşılaşılan Sorunlar ve Çözümleri (Troubleshooting)](#10-sık-karşılaşılan-sorunlar-ve-çözümleri-troubleshooting)

---

## 1. Proje Genel Tanımı ve Teknoloji Yığını

OdivonSchool; Türkiye Cumhuriyeti MEB ve ÖSYM müfredatına tam uyumlu, İlkokul (1-4), Ortaokul (5-8 & LGS), Lise (9-12 & YKS TYT/AYT) ve KPSS sınavlarına hazırlanan öğrenciler için geliştirilmiş modern, yapay zekâ destekli yeni nesil bir test çözme platformudur.

### Teknoloji Bileşenleri
- **Frontend Çatısı:** Angular 20.3 (Standalone Components, Signals, `toSignal`, modern `@if`/`@for` kontrol blokları)
- **Stil & Tasarım:** Vanilla SCSS, CSS Custom Properties (CSS Değişkenleri), responsive tasarım sistemi, Glassmorphism ve mikro animasyonlar
- **BaaS (Backend-as-a-Service):** Firebase 11 (Authentication, Cloud Firestore, Cloud Functions v2, Firebase Hosting)
- **Yapay Zekâ Entegrasyonu:** Google Gemini 2.0 Flash (`gemini-2.0-flash`) — JSON Schema ve REST API tabanlı doğrudan üretim
- **Derleyici & Paketleyici:** `@angular/build` (Vite & esbuild tabanlı ultra hızlı derleme)

---

## 2. Dizin ve Dosya Mimarisi

```
OdivonSchool/
├── .firebaserc                     # Firebase proje ve ortam eşleştirmeleri
├── firebase.json                   # Hosting, Firestore kuralları ve Functions tanımları
├── firestore.rules                 # Rol bazlı Firestore güvenlik kuralları
├── firestore.indexes.json          # Composite indeks tanımlamaları
├── package.json                    # Proje bağımlılıkları ve npm scriptleri
├── angular.json                    # Angular CLI yapılandırması
├── tsconfig.json                   # TypeScript kök yapılandırması
├── functions/                      # Firebase Cloud Functions (Node.js)
│   ├── index.js                    # Admin fonksiyonları (generateQuestions, reviewQuestion vb.)
│   └── package.json
├── md/                             # Dokümantasyon ve planlama dosyaları
│   ├── implementation_plan.md      # AI Soru Üretim & Denetim Planı
│   └── proje_islemleri_rehberi.md  # (Bu belge)
├── scripts/                        # Veritabanı yönetim ve CLI scriptleri
│   ├── categories.js               # 77 MEB & ÖSYM müfredat kategorisi kataloğu
│   ├── questions.js                # Elle hazırlanmış örnek soru havuzu
│   ├── seed-with-token.js          # Firebase CLI token'ı ile Firestore seed scripti
│   ├── seed.js                     # Servis hesabı JSON'ı ile çalışan seed scripti
│   └── generate-questions.js       # Gemini 2.0 Flash ile terminalden toplu soru üretici
└── src/
    ├── main.ts                     # Angular başlangıç noktası
    ├── index.html                  # Ana HTML şablonu
    ├── styles.scss                 # Global CSS değişkenleri, reset ve tema stilleri
    ├── environments/               # Firebase kimlik ve yapılandırma ortamları
    └── app/
        ├── app.config.ts           # ProvideRouter, ProvideFirebaseApp, ProvideFirestore
        ├── app.routes.ts           # Rota tanımları (Kullanıcı, Test, Admin)
        ├── models/                 # TypeScript veri modelleri ve arayüzler
        │   ├── question.ts         # Soru ve seçenek modelleri
        │   ├── test-category.ts    # Kategori ve kademe tanımları
        │   ├── test-attempt.ts     # Test çözme deneme kaydı
        │   ├── user.ts             # Kullanıcı profili ve rol modeli
        │   └── subscription.ts     # Abonelik modeli
        ├── core/
        │   ├── guards/             # AuthGuard ve AdminGuard rotaları koruma
        │   └── services/
        │       ├── auth.ts         # E-posta/Şifre oturum yönetimi
        │       ├── firestore.ts    # Firestore sorgu ve CRUD servis katmanı
        │       ├── ai-generator.ts # Gemini 2.0 Flash REST API soru motoru
        │       ├── test-session.ts # Test çözme anlık durum yönetimi (Signals)
        │       └── guest-quota.ts  # Misafir çözme kotası (3 soru sınırı)
        └── features/
            ├── auth/               # Giriş ve Kayıt bileşenleri (/giris, /kayit)
            ├── pricing/            # Fiyatlandırma ve Abonelik sayfası (/fiyatlandirma)
            ├── test-solve/         # Test ekranları:
            │   ├── category-select # 77 konudan test seçimi (/kategoriler)
            │   ├── solve/          # Çoktan seçmeli soru çözme alanı (/coz/:id)
            │   └── result/         # Test karnesi ve detaylı analiz (/sonuc/:id)
            ├── user-panel/         # Öğrenci kontrol merkezi:
            │   ├── dashboard/      # İstatistik özeti (/panel/genel-bakis)
            │   └── test-history/   # Geçmiş testler listesi (/panel/gecmis)
            └── admin-panel/        # Yönetici Kontrol Merkezi (/y0n3t1m-9f3a2):
                ├── dashboard/      # Platform istatistikleri
                ├── subscriber-list # Üye ve abone tablosu
                ├── subscriber-detail # Abone detayı ve yetkilendirme
                └── question-review # AI Soru Havuzu, Onay Masası ve Gemini Ayarları
```

---

## 3. Kurulum ve Yerel Geliştirme (Local Development)

### Ön Koşullar
1. **Node.js**: v18.x veya v20.x sürümü önerilir.
2. **npm**: Paket yöneticisi.
3. **Firebase CLI**: `npm install -g firebase-tools` (Firebase oturumu için `firebase login`).

### Adım Adım Kurulum

1. **Bağımlılıkları Yükleyin:**
   Angular 20 ve Firebase kütüphaneleri arasındaki peer-dependency uyumu için:
   ```bash
   npm install --legacy-peer-deps
   ```

2. **Geliştirme Sunucusunu Başlatın:**
   ```bash
   npm start
   ```
   Uygulama varsayılan olarak `http://localhost:4200` adresinde çalışır.

3. **Üretim (Production) Paketi Derleme:**
   ```bash
   npm run build
   ```
   Derlenen statik dosyalar `dist/odivon-school` dizinine optimize edilmiş olarak kaydedilir.

---

## 4. Kullanıcı ve Öğrenci İşlemleri (User Flows)

### 4.1. Misafir (Ziyaretçi) Çözme Modu
- Sisteme kayıt olmadan da öğrenciler ana sayfadan veya `/kategoriler` sayfasından bir test seçebilir.
- **Misafir Kotası (`GuestQuotaService`):**
  - Misafir kullanıcılar tarayıcı hafızasında (`localStorage`) tutulan kota ile en fazla 3 soru çözebilir.
  - 3. sorunun ardından sistem öğrenciyi test karnesi ve analizleri kaydetmek üzere ücretsiz hesap oluşturmaya yönlendirir.

### 4.2. Kayıt ve Giriş (`/kayit`, `/giris`)
- Firebase Authentication ile e-posta ve şifre kombinasyonu ile saniyeler içinde hesap oluşturulur.
- Yeni açılan hesaplar varsayılan olarak `role: 'user'` ve `subscriptionStatus: 'inactive'` olarak işaretlenir.

### 4.3. Öğrenci Paneli (`/panel`)
- **Genel Bakış (`/panel/genel-bakis`):**
  - Toplam çözülen soru adedi, doğru/yanlış oranları, genel başarı yüzdesi.
  - Kademelere ve derslere göre başarı dağılımı.
- **Ders & Konu Seçimi (`/kategoriler` veya `/panel/kategoriler`):**
  - 4 eğitim kademesi (İlkokul, Ortaokul, Lise, KPSS) altında 77 MEB & ÖSYM konusu listelenir.
  - İlgili derse tıklandığında soru havuzundan onaylanmış (`reviewStatus: 'approved'`) 5 veya 10 soru otomatik çekilir.
- **Test Çözme Ekranı (`/coz/:categoryId`):**
  - Geri sayım sayacı.
  - Seçenek işaretleme (A, B, C, D).
  - Yanlış cevap verildiğinde konuyu hemen öğreten **pedagojik çözüm açıklaması** (`explanation`).
  - Testi bitir butonu ile anında değerlendirme.
- **Karneler & Sonuç Ekranı (`/sonuc/:attemptId`):**
  - Doğru sayısı, yanlış sayısı, boş bırakılanlar ve 100 üzerinden puan.
  - Soruların tek tek çözümleri ve doğruları.
- **Geçmiş Denemeler (`/panel/gecmis`):**
  - Öğrencinin daha önce çözdüğü tüm testlerin tarihli arşiv ve başarı grafiği.

---

## 5. Yönetici (Admin) Paneli ve Operasyonları

Sistem yöneticileri için güvenli, gizli bir rota kurgulanmıştır.

### 5.1. Admin Rotası & Güvenlik
- **Yönetim Rotası:** `http://localhost:4200/y0n3t1m-9f3a2` (İstenirse `src/app/app.routes.ts` üzerinden değiştirilebilir).
- **AdminGuard:** Oturum açmamış veya Firestore'daki `users/{uid}` kaydında `role: 'admin'` olmayan kullanıcılar giriş yapamaz, otomatik olarak ana sayfaya yönlendirilir.

### 5.2. İlk Kullanıcıya Admin Rolü Verme
Yeni kurulan bir ortamda ilk admin yetkisini vermek için:
1. Firebase Console > Firestore Database > `users` koleksiyonuna gidin.
2. Kendi kullanıcı dokümanınızı bulun (`users/{kendi_uid_değeriniz}`).
3. Dokümandaki `role` alanının değerini `"user"` yerine `"admin"` olarak değiştirin.
4. Tarayıcıyı yenilediğinizde panel erişimi anında aktif olacaktır.

### 5.3. Admin Alt Menüleri
1. **Genel Bakış (`/y0n3t1m-9f3a2/genel-bakis`):**
   - Kayıtlı toplam üye, aktif abone ve çözülen toplam test istatistikleri.
2. **Aboneler (`/y0n3t1m-9f3a2/aboneler`):**
   - Tüm kullanıcıların e-postası, adı, abonelik durumu (`active`/`inactive`), rolü ve kayıt tarihi.
   - İsim veya e-postaya göre canlı arama filtrelemesi.
3. **Abone Detayı (`/y0n3t1m-9f3a2/abone/:uid`):**
   - Kullanıcının çözdüğü tüm testlerin listesi ve tek tıkla rolünü admin yapma / kaldırma yetkisi.
4. **AI Soru Havuzu (`/y0n3t1m-9f3a2/sorular`):**
   - Yapay zekâ ile yeni soru üretme, taslakları gözden geçirme, düzenleme ve canlıya alma masası.

---

## 6. Yapay Zekâ (Gemini 2.0 Flash) Soru Üretim Motoru

Soru üretim mimarisi, ek bir sunucu bağımlılığı olmaksızın doğrudan Google Gemini REST API'si üzerinden çalışacak şekilde tasarlanmıştır.

### 6.1. Mimari Prensipler
- **Hız:** Gemini 2.0 Flash modeli saniyeler içerisinde 10 adet pedagojik test sorusu üretir.
- **Müfredat Uyumu:** Prompt, MEB & ÖSYM standartlarına göre kademe (İlkokul/Ortaokul/Lise/KPSS), ders, ana konu ve özel odak kavramını içerir.
- **Öğretici Çözüm Zorunluluğu:** Her soru için mutlaka öğrenciye konunun mantığını kavratan bir `explanation` üretilir.
- **Çift Aşamalı Güvenlik (Approval Gate):** Üretilen sorular doğrudan canlıya çıkmaz; Firestore'a `reviewStatus: 'draft'` olarak kaydedilir. Yönetici onaylayınca `approved` olur.

### 6.2. Gemini API Anahtarı Tanımlama
1. [Google AI Studio](https://aistudio.google.com/app/apikey) adresinden ücretsiz bir API anahtarı alın.
2. Yönetici panelinde (`/y0n3t1m-9f3a2/sorular`) sağ üstteki **"🔑 API Anahtarı Gerekli"** butonuna tıklayın.
3. Açılan modal penceresine anahtarınızı yapıştırıp **"Test Et & Kaydet"** butonuna basın.
4. Sistem `testApiKey()` ile Gemini servisine bir ping gönderir. Doğrulandığında anahtar tarayıcı hafızasında saklanır ve durum **"⚡ Gemini 2.0 Flash (Bağlı)"** yeşile döner.

### 6.3. Soru Üretim Formu Parametreleri
- **Ders & Konu Seçimi:** 77 kategoriden biri (İlkokul, Ortaokul, Lise veya KPSS).
- **Soru Adedi:** 3, 5, 10 veya 15 soru.
- **Hedef Zorluk:**
  - `1`: Çok Kolay (Temel Kavram)
  - `2`: Kolay (Kavrama ve Uygulama)
  - `3`: Orta (Standart Sınav Düzeyi)
  - `4`: Zor (Muhakeme & Analiz)
  - `5`: İleri Düzey (Eleme Sorusu)
  - `0`: Karışık (Dengeli Dağılım)
- **Özel Odak / Alt Başlık:** İsteğe bağlı (Örn: *"İki Kare Farkı Özdeşliği"*, *"Pascal Prensibi"*).

### 6.4. Taslak Soru Denetim Masası Aksiyonları
- **Onayla & Yayınla:** Tek tıkla soruyu `approved` yapar. Soru anında öğrencilerin çözebileceği soru havuzuna geçer.
- **Tümünü Onayla:** Sayfada bekleyen tüm taslak soruları tek hamlede toplu olarak (`writeBatch`) onaylar.
- **Düzenle (Modal):** Soru metnini, 4 seçeneğin içeriğini, doğru cevabın harfini veya çözüm açıklamasını yayınlamadan önce revize etmenizi sağlar.
- **Reddet / Sil:** Kalite standardına uymayan soruyu veritabanından kalıcı olarak temizler.

---

## 7. Terminal ve CLI Script İşlemleri (Otomasyon)

Toplu işlemler ve arka plan veri beslemeleri için `scripts/` klasöründe iki temel CLI aracı yer alır:

### 7.1. Müfredat Kategorilerini ve Örnek Soruları Yükleme (`seed-with-token.js`)
Sistemin 77 MEB & ÖSYM kategorisini ve hazır örnek soruları veritabanına aktarmak için:

1. Firebase CLI ile oturum açtığınızdan emin olun (`firebase login`).
2. Terminalde komutu çalıştırın:
   ```bash
   node scripts/seed-with-token.js
   ```
3. Script; `scripts/categories.js` içerisindeki 77 kategoriyi `categories` koleksiyonuna ve `scripts/questions.js` içindeki örnek soruları `questions` koleksiyonuna yazar.

---

### 7.2. Terminalden Toplu AI Soru Üretimi (`generate-questions.js`)
Admin paneline girmeden, terminal üzerinden arka planda yüzlerce soru ürettirip Firestore'a eklemek için:

#### Kullanım Sözdizimi:
```bash
node scripts/generate-questions.js --apiKey=YOUR_GEMINI_API_KEY [SEÇENEKLER]
```

#### Desteklenen Parametreler:
| Parametre | Açıklama | Varsayılan Değer | Örnek Değerler |
| :--- | :--- | :--- | :--- |
| `--apiKey` | Google Gemini API Anahtarı (Zorunlu) | `$GEMINI_API_KEY` | `AIzaSyD...` |
| `--category` | Hedef kategori ID'si (Katalogdan) | `ortaokul-matematik-carpanlar-katlar` | `lise-fizik-kuvvet-hareket` |
| `--count` | Üretilecek soru adedi | `5` | `10` |
| `--difficulty` | Zorluk derecesi (1-5) | `2` | `3` veya `4` |
| `--draft` | Soruları taslak olarak kaydet (onay gerektirir) | *Belirtilmezse doğrudan approved olur* | `--draft` |

#### Örnek Terminal Komutları:

**Örnek 1: LGS Matematik için 5 adet orta seviye onaylı soru üretme:**
```bash
node scripts/generate-questions.js --apiKey=AIzaSy... --category=ortaokul-matematik-uslu-ifadeler --count=5 --difficulty=3
```

**Örnek 2: YKS TYT Türkçe için 10 adet taslak soru üretme (Admin onayına düşer):**
```bash
node scripts/generate-questions.js --apiKey=AIzaSy... --category=lise-turkce-paragrafta-anlam --count=10 --difficulty=4 --draft
```

**Örnek 3: KPSS Genel Yetenek Matematik için soru üretme:**
```bash
node scripts/generate-questions.js --apiKey=AIzaSy... --category=kpss-gy-matematik-problemler --count=5 --difficulty=3
```

---

## 8. Veritabanı Mimarisi, Şemalar ve Güvenlik Kuralları

Cloud Firestore NoSQL mimarisinde 5 ana koleksiyon bulunmaktadır:

### 8.1. `categories` Koleksiyonu
Doküman ID'si kategori slug'ıdır (Örn: `lise-matematik-turev`).
```json
{
  "id": "lise-matematik-turev",
  "level": "lise",
  "subject": "Matematik",
  "topic": "Türev ve Uygulamaları",
  "description": "Türev alma kuralları, geometrik yorum ve ekstremum noktalar.",
  "order": 12
}
```

### 8.2. `questions` Koleksiyonu
```json
{
  "id": "ortaokul-matematik-carpanlar-katlar_ai_1741558000000_1",
  "categoryId": "ortaokul-matematik-carpanlar-katlar",
  "level": "ortaokul",
  "subject": "Matematik",
  "prompt": "Kenar uzunlukları 24 m ve 36 m olan bir bahçenin etrafına eşit aralıklarla fidan dikilecektir...",
  "options": [
    { "id": "a", "text": "10" },
    { "id": "b", "text": "12" },
    { "id": "c", "text": "14" },
    { "id": "d", "text": "16" }
  ],
  "correctOptionId": "a",
  "explanation": "Bu bir EBOB problemidir. EBOB(24, 36) = 12 metredir. Çevre = 2 x (24 + 36) = 120 m. Fidan sayısı = 120 / 12 = 10 adettir.",
  "difficulty": 3,
  "source": "ai-generated",
  "aiModel": "gemini-2.0-flash",
  "reviewStatus": "approved",
  "createdAt": 1741558000000,
  "usageCount": 42,
  "correctCount": 31
}
```

### 8.3. `testAttempts` Koleksiyonu
```json
{
  "userId": "firebase_auth_uid_123",
  "categoryId": "lise-fizik-kuvvet-hareket",
  "level": "lise",
  "subject": "Fizik",
  "totalQuestions": 5,
  "correctCount": 4,
  "wrongCount": 1,
  "emptyCount": 0,
  "score": 80,
  "startedAt": 1741558100000,
  "completedAt": 1741558350000
}
```

### 8.4. `users` Koleksiyonu
```json
{
  "uid": "firebase_auth_uid_123",
  "email": "ogrenci@odivon.com",
  "displayName": "Ali Yılmaz",
  "role": "user",
  "subscriptionStatus": "active",
  "createdAt": 1741550000000
}
```

### 8.5. Firestore Güvenlik Kuralları (`firestore.rules`)
- **Kategoriler:** Herkes tarafından okunabilir (`allow read: if true;`), sadece admin yazabilir.
- **Sorular:** Onaylanmış sorular (`reviewStatus == 'approved'`) öğrenciler ve misafirler tarafından okunabilir. Taslak sorular sadece adminler tarafından okunabilir ve düzenlenebilir.
- **Test Denemeleri:** Öğrenciler yalnızca kendi deneme sonuçlarını oluşturabilir ve görüntüleyebilir.

---

## 9. Canlıya Alma ve Dağıtım (Deployment)

Projeyi Firebase altyapısına canlı olarak dağıtmak için aşağıdaki adımları uygulayın:

### 9.1. Firestore Kuralları ve İndekslerini Yükleme
```bash
firebase deploy --only firestore:rules,firestore:indexes
```

### 9.2. Web Uygulamasını (Hosting) Yayınlama
1. Production derlemesini alın:
   ```bash
   npm run build
   ```
2. Hosting'e dağıtın:
   ```bash
   firebase deploy --only hosting
   ```
Uygulamanız Firebase tarafından sağlanan canlı alan adında (Örn: `https://odivonschool.web.app`) yayınlanacaktır.

---

## 10. Sık Karşılaşılan Sorunlar ve Çözümleri (Troubleshooting)

### Q1: `npm install` çalışırken `ERESOLVE could not resolve` hatası veriyor
- **Sebep:** `@angular/fire` ile Angular 20 arasındaki geçici peer-dependency çakışması.
- **Çözüm:** Her zaman `--legacy-peer-deps` bayrağı ile kurun:
  ```bash
  npm install --legacy-peer-deps
  ```

### Q2: Gemini API soru üretirken `400 / 403` hatası veriyor
- **Sebep:** Girilen API anahtarının süresi dolmuş veya geçersiz olabilir.
- **Çözüm:** Admin panelindeki sağ üst API durum çubuğuna tıklayın, [Google AI Studio](https://aistudio.google.com/app/apikey) sayfasından yeni bir anahtar oluşturup **"Test Et & Kaydet"** butonuna basarak yeşil onay mesajını görün.

### Q3: Sorular üretildi ancak `/kategoriler` ekranında görünmüyor
- **Sebep:** Üretilen sorular güvenlik gereği ilk olarak **Taslak (Draft)** havuzuna düşer.
- **Çözüm:** `/y0n3t1m-9f3a2/sorular` sayfasına gidin, üretilen soruları kontrol edip **"Onayla & Yayınla"** veya **"Tümünü Onayla"** butonuna basın. Onaylanan sorular derhal öğrenci ekranlarına yansıyacaktır.

### Q4: Admin paneline girmeye çalışınca ana sayfaya atıyor
- **Sebep:** Kullanıcınızın Firestore'daki `role` değeri `admin` değildir.
- **Çözüm:** Firebase Console üzerinden Firestore `users/{uid}` dokümanındaki `role` alanını `"admin"` olarak güncelleyin.
