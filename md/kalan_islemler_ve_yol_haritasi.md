# OdivonSchool — Kalan & Yapılabilecek İşlemler Yol Haritası

Bu belge; OdivonSchool projesinin mevcut durumunu, tamamlanmış bileşenlerini ve bir sonraki çalışma oturumunda ele alınabilecek **kalan / geliştirilebilir tüm işlemleri** detaylı olarak listeler.

---

## 📊 Mevcut Durum Özeti

- **Canlı Dağıtım URL'i:** [https://odivonschool.web.app](https://odivonschool.web.app) (Firebase Hosting üzerinde canlıda)
- **Firebase Konsolu:** [https://console.firebase.google.com/project/odivonschool/overview](https://console.firebase.google.com/project/odivonschool/overview)
- **Kategori Sayısı:** Firestore'da **88 Kategori** (İlkokul, Ortaokul, Lise, KPSS) tanımlı.
- **Soru Sayısı:** Firestore'da şu an **77 Onaylı Soru** bulunuyor.
- **Tamamlanan Sayfalar:**
  - ✅ **Ana Sayfa (Landing Page):** İnteraktif demo sorulu, animasyonlu, 4 kademe tanıtımlı modern karşılama sayfası (`/`).
  - ✅ **Öğrenci Paneli & İstatistikler:** Dashboard, başarı oranları, test geçmişi (`/panel/anasayfa`, `/panel/gecmis`).
  - ✅ **Öğrenci Profil & Ayarlar:** İsim, sınıf seviyesi güncelleme, şifre sıfırlama e-postası (`/panel/profil`).
  - ✅ **Test Çözme Motoru:** Zamanlayıcı, 4 seçenek, "Pas Geç / Boş Bırak", "Çözümü İncele" ve detaylı çözüm açıklamaları (`/coz/:id`).
  - ✅ **Fiyatlandırma & Ödeme:** Pro/VIP paketler, 256-bit SSL ödeme modalı ve anında üyelik aktivasyonu (`/fiyatlandirma`).
  - ✅ **Admin Yönetim Paneli:** Kullanıcı yetkilendirme (Admin/User), üyelik statüsü tanımlama (Pro/Trial/Expired), Gemini 2.0 Flash soru üretim ve onay masası (`/yonetim`).

---

## 📌 Kalan ve Yapılabilecek İşlemler Listesi

---

### 1. 🎯 Soru Havuzunu Büyütmek (En Öncelikli İçerik Adımı)

- **Mevcut Durum:** 
  Veritabanında 88 kategori bulunmasına rağmen toplamda 77 soru var. Dolayısıyla birçok ders/konuda henüz soru bulunmuyor (öğrenci girdiğinde *"Bu kategoride henüz soru yok"* uyarısı alıyor).
- **Yapılacak İşlem:**
  Hazırladığımız `batch-generate-all.js` scripti ile Google Gemini 2.0 Flash'a her kategori için 3'er veya 5'er soru ürettirip doğrudan Firestore'a yazdırmak.
- **Çalıştırma Komutu:**
  ```bash
  # Kategori başına 3 soru (Toplam ~264 yeni soru ekler):
  node scripts/batch-generate-all.js --apiKey=YOUR_GEMINI_API_KEY --count=3 --delay=4000

  # Veya önce taslak olarak onay masasına düşürmek için:
  node scripts/batch-generate-all.js --apiKey=YOUR_GEMINI_API_KEY --count=3 --delay=4000 --draft
  ```
- **Kazanım:** Bütün dersler dolu hale gelir, hiçbir öğrenci boş kategoriyle karşılaşmaz.

---

### 2. 💳 Gerçek Sanal POS / Ödeme Sağlayıcısı Entegrasyonu (Ticari Satış)

- **Mevcut Durum:**
  Şu anda `/fiyatlandirma` sayfasında çalışan ödeme modalı simüle kart yetkilendirmesi yaparak kullanıcının üyeliğini veritabanında anında **"🌟 Aktif Pro"** statüsüne geçiriyor.
- **Yapılacak İşlem:**
  Gerçek kredi kartı tahsilatı ve abonelik faturalandırması için yerli/yabancı bir ödeme kuruluşu ile sözleşme yapılıp API entegrasyonunun tamamlanması:
  - **Iyzico:** Türkiye içi kredi/banka kartı ve abonelik (subscription) API'si.
  - **PayTR:** Sanal POS ve iFrame API entegrasyonu.
  - **Stripe:** Uluslararası ödemeler ve abonelik yönetimi.
- **Teknik Detay:**
  Ödeme sağlayıcısının webhook bildirimlerini dinlemek için Firebase projesinin **Blaze planına** geçirilmesi ve bir HTTP Cloud Function (`functions/src/paymentWebhook.ts`) yazılması.

---

### 3. 🌐 Özel Alan Adı (Custom Domain) Bağlama

- **Mevcut Durum:**
  Platform şu an Firebase'in ücretsiz `https://odivonschool.web.app` alan adında çalışıyor.
- **Yapılacak İşlem:**
  Kurumsal alan adının (örneğin `odivonschool.com` veya `odivon.com`) bağlanması:
  1. Firebase Console > Hosting > **"Özel etki alanı ekle"** butonuna tıklanır.
  2. Domain sağlayıcınızın (GoDaddy, Namecheap, Natro vb.) DNS yönetim paneline Firebase'in vereceği **A** ve **TXT** kayıtları girilir.
  3. Firebase otomatik olarak ücretsiz SSL sertifikası (HTTPS) tanımlar.

---

### 4. ✉️ Firebase Kurumsal E-posta Şablonlarının Özelleştirilmesi

- **Mevcut Durum:**
  Öğrencilerin profil sayfasından talep ettiği şifre sıfırlama e-postaları Firebase'in varsayılan şablonuyla iletiliyor.
- **Yapılacak İşlem:**
  1. Firebase Console > Authentication > **Templates** sekmesine gidilir.
  2. **Password Reset (Şifre Sıfırlama)** ve **Email Verification (E-posta Doğrulama)** şablonları açılır.
  3. Gönderici adı `OdivonSchool`, yanıt e-postası `destek@odivon.com` ve e-posta içeriği kurumsal Türkçe karşılama metinleriyle güncellenir.

---

### 5. 🚩 Test Çözme Ekranı İnce Geliştirmeleri

- **A. Hatalı Soru Bildir (Report Question) Butonu:**
  - Soru kartının sağ üst köşesine küçük bir bayrak ikonu (🚩) eklenir.
  - Öğrenci bir yazım yanlışı, mantık hatası veya yanlış şık gördüğünde tek tıkla *"Soru Hatalı"* bildirimi bırakır. Bildirim doğrudan Firestore `questionReports` koleksiyonuna düşer ve admin panelinde listelenir.
- **B. Soru Kaydetme / Favorilere Ekleme (Bookmarks):**
  - Öğrencinin zorlandığı veya beğendiği soruları favorilerine kaydedip daha sonra `/panel/favorilerim` sayfasından tekrar çözebilmesi.
- **C. PDF Test Çıktısı Alma:**
  - Öğretmenlerin veya öğrencilerin seçtikleri 10 soruluk testi yazdırılabilir PDF formatında indirebilmesi.

---

### 6. ⚡ Güvenlik ve Performans İyileştirmeleri (İleri Düzey)

- **Admin Custom Claims:**
  - Şu an Firestore kurallarındaki `isAdmin()` kontrolü `users/{uid}` dokümanını okuyarak yapılıyor.
  - Firebase Admin SDK ile `setCustomUserClaims(uid, { admin: true })` tanımlanırsa, güvenlik kuralı `request.auth.token.admin == true` şeklinde sıfır veritabanı okuma maliyetiyle ve daha hızlı çalışır.
- **Gece Görevi (Cloud Scheduler & Cron Job):**
  - Her gece otomatik olarak en çok çözülen derslere yeni Gemini soruları üreten arka plan görevi kurgulanabilir.

---

## 🚀 Önerilen Başlangıç Sırası (Sonraki Oturum İçin)

| Öncelik | Başlık | Neden Yapılmalı? | Tahmini Süre |
| :---: | :--- | :--- | :---: |
| **1** | **Soru Havuzunu Doldurmak (`batch-generate-all.js`)** | Sitede boş konu kalmaması ve test deneyiminin zenginleşmesi için. | ~15-20 dk (API hızına bağlı) |
| **2** | **Hatalı Soru Bildir (🚩) Butonu** | Soru kalitesini canlı tutmak ve öğrenci geri bildirimini almak için. | ~20 dk |
| **3** | **Soru Favorileme (Bookmark) Sistemi** | Öğrencinin zorlandığı soruları tekrar çözebilmesi için. | ~30 dk |
| **4** | **Özel Domain & E-posta Şablonları** | Markalaşma ve kurumsal görünüm için. | ~15 dk |
| **5** | **Canlı Sanal POS / Iyzico Entegrasyonu** | Ticari üyelik satışlarına başlamak için. | Gerekli sözleşme sonrası |
