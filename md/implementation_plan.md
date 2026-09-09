# Yapay Zekâ ile Otomatik Soru Üretimi ve Denetim Havuzu Planı

Bu plan; OdivonSchool platformunda **Google Gemini AI (Gemini 2.0 Flash)** modeli kullanılarak MEB & ÖSYM müfredatına tam uyumlu çoktan seçmeli test sorularının otomatik üretilmesini, yönetici onay havuzuna düşürülmesini, tek tıkla düzenleme, onaylama ve yayınlama süreçlerini kapsar.

---

## User Review Required

> [!IMPORTANT]
> **Gemini API Bağlantı Mimarisi:**
> - Firebase Cloud Functions (v2), Firebase'in Blaze (ücretli/kredi kartı tanımlı) planını ve Cloud Secret Manager'ı gerektirdiğinden ve henüz canlı fonksiyona dağıtılmadığından; soru üretimi **Admin Paneli içerisindeki dinamik AI motoru (`AiQuestionGeneratorService`)** ve **Node.js CLI scripti** üzerinden doğrudan Gemini 2.0 Flash REST API'sine bağlanacak şekilde yapılandırılacaktır.
> - Yöneticiler, Google AI Studio'dan aldıkları **ücretsiz Gemini API anahtarını** panelde bir defa girip kaydedebilecek ("Bu tarayıcıda güvenle hatırla" veya sistem ayarları).
> - Onaylama, silme ve düzenleme işlemleri ise Cloud Functions yerine doğrudan Firestore Güvenlik Kurallarındaki `isAdmin()` yetkisiyle anında ve beklemesiz çalışacaktır.

---

## Proposed Changes

### 1. Yapay Zekâ Soru Üretim Servisi (AI Generator Engine)

#### [NEW] [ai-generator.ts](file:///c:/Users/dogan/Downloads/odivon-school/src/app/core/services/ai-generator.ts)
- Google Gemini 2.0 Flash API (`gemini-2.0-flash`) entegrasyonu.
- **Parametreler:**
  - `categoryId`: Seçilen ders/konu (Firestore'daki 77 kategoriden biri).
  - `count`: Üretilecek soru adedi (1 - 10 arası).
  - `difficulty`: Hedef zorluk derecesi (1: Çok Kolay, 2: Kolay, 3: Orta, 4: Zor, 5: İleri Düzey).
  - `subTopic`: İsteğe bağlı odak konu/kavram (örn: "Pascal Prensibi", "Eldeli Toplama", "Türevde Teğet Eğimi").
- **Müfredat Tabanlı Prompt Mühendisliği:**
  - MEB ve ÖSYM kazanımlarına tam uyum.
  - 4 seçenek (`A`, `B`, `C`, `D`), tek doğru cevap.
  - Öğrenci yanlış yaptığında konuyu kavratan **öğretici ve pedagojik çözüm açıklaması** zorunluluğu.
  - Gemini `responseMimeType: 'application/json'` ve JSON şeması ile %100 hatasız JSON çıktısı.
- **API Anahtarı Yönetimi:**
  - `localStorage` ve Firestore `systemSettings/ai` üzerinde saklama, getirme ve test etme (`testApiKey(key)`).
- **Firestore Kayıt:**
  - Üretilen soruları Firestore `questions` koleksiyonuna `reviewStatus: 'draft'`, `source: 'gemini-2.0-flash'`, `createdAt: Date.now()` olarak yazar.

---

### 2. Admin AI Soru Havuzu Bileşeni Geliştirmesi

#### [MODIFY] [question-review.ts](file:///c:/Users/dogan/Downloads/odivon-school/src/app/features/admin-panel/question-review/question-review.ts)
#### [MODIFY] [question-review.html](file:///c:/Users/dogan/Downloads/odivon-school/src/app/features/admin-panel/question-review/question-review.html)
#### [MODIFY] [question-review.scss](file:///c:/Users/dogan/Downloads/odivon-school/src/app/features/admin-panel/question-review/question-review.scss)
- **77 Müfredat Konusu Dinamik Seçici:**
  - Statik 17 konu yerine, Firestore'daki 77 kategoriyi kademelere göre gruplandırılmış (🌱 İlkokul, 🎒 Ortaokul, 🏛️ Lise, 💼 KPSS) dinamik açılır liste veya arama kutusu.
- **Gelişmiş Üretim Kontrolleri:**
  - Soru adedi (3, 5, 10).
  - Zorluk seçimi (Kolay, Orta, Zor, Karışık).
  - İsteğe bağlı "Özel Odak / Konu Detayı" metin kutusu.
  - **API Anahtarı Giriş / Ayar Çubuğu** (Şifreli gösterim, "Anahtarı Değiştir" butonu ve ücretsiz Google AI Studio API anahtarı alma kılavuz linki).
- **Gelişmiş Taslak Yönetimi & Düzenleme:**
  - **Tek Tıkla Onayla & Yayınla:** Soruyu `approved` durumuna geçirir, soru anında öğrencilerin çözebileceği havuza dahil olur.
  - **Tümünü Onayla:** Üretilen soruların tamamını tek tıkla canlıya alır.
  - **Düzenle (Modal):** Soru metnini, şıkları veya çözüm açıklamasını yayınlamadan önce revize etme imkânı.
  - **Reddet & Sil:** İstenmeyen soruları veritabanından kalıcı olarak temizler.

---

### 3. Toplu Üretim CLI Scripti (Terminalden Toplu Üretim)

#### [NEW] [generate-questions.js](file:///c:/Users/dogan/Downloads/odivon-school/scripts/generate-questions.js)
- Terminal üzerinden istenen kategori ID'si ve adedi belirtilerek arka planda yüzlerce soru üretebilen Node.js CLI scripti (`node scripts/generate-questions.js --category=lise-matematik-turev --count=10`).

---

## Verification Plan

### Otomatik & Birim Testleri
1. `npx ng build --configuration production` komutunun hatasız tamamlandığının doğrulanması.
2. `scripts/generate-questions.js` ile örnek kategori üzerinde soru üretimi testi.

### Manuel Doğrulama (Tarayıcı & Admin Paneli)
1. `/y0n3t1m-9f3a2/sorular` sayfasına gidilmesi.
2. 77 kategorinin gruplu şekilde yüklendiğinin doğrulanması.
3. Gemini API anahtarı girilerek bağlantının test edilmesi.
4. "Soruları Üret" butonuna basılarak 3-5 adet yeni sorunun üretilmesi.
5. Üretilen soruların "Onay Bekleyen Taslaklar" listesinde seçenekleri ve açıklamalarıyla belirdiğinin görülmesi.
6. Bir sorunun "Onayla" butonuna basılarak onaylanması ve öğrenci ekranında ([/kategoriler](https://odivonschool.web.app/kategoriler)) test içerisinde geldiğinin teyit edilmesi.
