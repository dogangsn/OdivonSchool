# Bildirimler: canlıya alma rehberi

Bu klasördeki iki zamanlanmış fonksiyon ve web uygulamasındaki bildirim
ayarları **hazır**, ama Firebase projesi Blaze (kullandıkça öde) planına
geçmeden çalışmaz. O güne kadar site normal çalışır; Profil sayfasındaki
"Tarayıcı bildirimleri" anahtarı gizlidir ve "henüz hazırlanıyor" notu görünür.

## Ne yapıyorlar?

| Fonksiyon | Ne zaman | Ne yapar |
|---|---|---|
| `dailyDigest` | Her gün 18:00 (Türkiye saati) | Bildirimi açık her kullanıcıya **günde en fazla bir** anlık bildirim gönderir. Öğrenci: bugün/yarın teslim edilecek ve henüz yapmadığı ödevler, sınıflarındaki yeni ödevler, kendi kademe/sınıfına havuza eklenen yeni sorular. Öğretmen: süresi dolan ödevlerin teslim durumu, sınıfa katılan yeni öğrenciler. Söylenecek bir şey yoksa bildirim gönderilmez. |
| `teacherWeeklyEmail` | Her pazar 19:00 (Türkiye saati) | Gerçek e-posta adresi olan her öğretmene sınıf başına haftalık özet: bu hafta aktif öğrenci sayısı, 7+ gündür girmeyenler, süresi geçmiş ödevler (son 30 gün), zayıf konular. E-postayı `mail` koleksiyonuna yazar; asıl gönderimi "Trigger Email from Firestore" eklentisi yapar. |

Kullanıcı tercihleri: `users/{uid}.notifyPush === false` olan kişiye bildirim,
`users/{uid}.notifyEmail === false` olan öğretmene e-posta gönderilmez
(Profil → Bildirim ayarları). Öğretmenin açtığı kullanıcı adlı öğrenci
hesaplarına hiçbir zaman e-posta gönderilmez.

## Canlıya alma adımları (proje sahibi)

1. **Blaze planına geçin.**
   Firebase konsolu → sol alttaki plan adı (Spark) → *Upgrade* → *Blaze*.
   Bir faturalama hesabı bağlamanız gerekir. İsterseniz Google Cloud konsolunda
   *Billing → Budgets & alerts* ile aylık bütçe uyarısı (ör. 5 USD) kurun.
   Bu iki fonksiyon günde/haftada bir çalıştığı için maliyet normalde
   ücretsiz kotanın içinde kalır.

2. **Web Push sertifikası (VAPID anahtarı) oluşturun.**
   Firebase konsolu → ⚙️ *Project settings* → *Cloud Messaging* sekmesi →
   *Web configuration* → *Web Push certificates* → **Generate key pair**.
   Oluşan uzun "Key pair" değerini (genel anahtar) kopyalayın ve şu iki
   dosyada `vapidKey: ''` satırına yapıştırın:
   - `src/environments/environment.ts`
   - `src/environments/environment.production.ts`

   ```ts
   vapidKey: 'BOrn...uzun-anahtar...',
   ```
   Bu anahtar herkese açık bir anahtardır, depoya eklenmesinde sakınca yoktur.
   (Aynı sayfada *Firebase Cloud Messaging API (V1)*'in "Enabled" olduğunu
   kontrol edin; kapalıysa yanındaki menüden açın.)

3. **"Trigger Email from Firestore" eklentisini kurun.**
   Firebase konsolu → *Extensions* → **Trigger Email from Firestore**
   (firebase/firestore-send-email) → *Install*. Kurulumda:
   - *Email documents collection*: `mail`
   - *SMTP connection URI*: SMTP sağlayıcınızın adresi, ör.
     `smtps://kullanici@alanadi.com@smtp.gmail.com:465` (Gmail için bir
     "uygulama şifresi" gerekir) veya SendGrid / Brevo / Mailgun SMTP bilgileri.
   - *SMTP password*: SMTP şifreniz (Secret Manager'da saklanır).
   - *Default FROM address*: ör. `Odivon School <bildirim@alanadiniz.com>`
   - Diğer alanlar varsayılan kalabilir.

   Eklenti `mail` koleksiyonuna eklenen `{ to, message: { subject, html, text } }`
   belgelerini gönderir ve sonucu aynı belgenin `delivery` alanına yazar.
   Gönderim hatalarını oradan görebilirsiniz.

4. **Yayınlayın.** Proje kökünde:
   ```bash
   cd functions && npm install && npm test && cd ..
   npx ng build
   firebase deploy --only functions,hosting
   ```
   İlk dağıtımda Firebase, Cloud Scheduler ve ilgili API'leri açmak için onay
   isteyebilir; "y" ile onaylayın.

5. **Deneyin.**
   - Siteye girin → *Profil* → *Bildirim ayarları* → "Tarayıcı bildirimleri"ni
     açın, tarayıcının izin penceresinde *İzin ver*'i seçin.
   - Google Cloud konsolu → *Cloud Scheduler* → `firebase-schedule-dailyDigest-…`
     satırında **Force run** ile özeti hemen çalıştırabilirsiniz (o gün söylenecek
     bir şey yoksa bildirim gelmez; yarın teslim edilecek bir ödev oluşturmak
     kolay bir deneme yoludur).
   - Haftalık e-posta için `firebase-schedule-teacherWeeklyEmail-…` satırında
     *Force run*; ardından Firestore'da `mail` koleksiyonuna bakın.
     Aynı hafta içinde ikinci kez çalıştırmak aynı öğretmene ikinci e-posta
     göndermez.

## Teknik notlar

- Bölge: diğer fonksiyonlar gibi varsayılan bölge (`us-central1`).
- Site adresi: e-posta ve bildirim bağlantıları `https://<proje-id>.web.app`
  adresini kullanır. Özel alan adınız varsa fonksiyonlara `APP_URL` ortam
  değişkeni verin (`functions/.env` dosyasına `APP_URL=https://alanadiniz.com`).
- Bildirim belirteçleri `users/{uid}/fcmTokens/{id}` altında durur; artık
  geçersiz olanlar (FCM `registration-token-not-registered`) gönderim
  sırasında otomatik silinir.
- Aynı gün iki kez bildirim gitmemesi için `notifyState/{uid}` belgesi
  (yalnızca sunucu okur/yazar) son gönderim gününü tutar.
- Bir çalıştırmada en fazla 20.000 belirteç ve 2.000 sınıf işlenir.
- Testler: `cd functions && npm test` (Node'un yerleşik test çalıştırıcısı;
  `src/notifyLogic.ts` içindeki saf fonksiyonları dener).
- Servis çalışanı: `src/firebase-messaging-sw.js` (derlemede sitenin köküne
  kopyalanır). Firebase sürümünü yükseltirseniz dosyanın başındaki
  `firebasejs/11.10.0` adreslerini de güncelleyin.

## kitapPdf (Akıllı Kütüphane)

Akıllı Kütüphane kitapları önce doğrudan MEB'in bağlantısından açmayı dener. MEB'in sunucusu tarayıcının PDF'i başka siteden okumasına izin vermezse okuyucu "PDF'i MEB'de aç / indirdiğim PDF'i aç" seçeneklerini gösterir. Kitapların uygulama içinde her zaman açılması için:

1. Fonksiyonları deploy et (Blaze gerekir): `firebase deploy --only functions:kitapPdf`
2. `src/environments/environment*.ts` içindeki `libraryProxyUrl` alanına fonksiyon adresini yaz (ör. `https://us-central1-odivonschool.cloudfunctions.net/kitapPdf`).

Fonksiyon yalnızca MEB adreslerini (tymm.meb.gov.tr, meb.ai) açar; PDF'leri saklamaz, akış olarak iletir.
