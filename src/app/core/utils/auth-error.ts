/**
 * Firebase Authentication hata kodlarını kullanıcı dostu Türkçe açıklamalara dönüştürür.
 */
export function getAuthErrorMessage(error: unknown): string {
  if (!error) {
    return 'Bilinmeyen bir hata oluştu. Lütfen tekrar deneyin.';
  }

  const err = error as { code?: string; message?: string };
  const code = err.code || '';

  const messages: Record<string, string> = {
    // E-posta / Şifre Kayıt ve Giriş
    'auth/email-already-in-use':
      'Bu e-posta adresiyle kayıtlı bir hesap zaten var. Lütfen giriş yapın veya şifrenizi sıfırlayın.',
    'auth/invalid-email':
      'Lütfen geçerli bir e-posta adresi giriniz.',
    'auth/weak-password':
      'Şifreniz çok zayıf. Lütfen en az 6 karakterden oluşan bir şifre belirleyin.',
    'auth/user-not-found':
      'Bu e-posta adresiyle kayıtlı bir hesap bulunamadı.',
    'auth/wrong-password':
      'E-posta veya şifre hatalı. Lütfen bilgilerinizi kontrol edin.',
    'auth/invalid-credential':
      'E-posta veya şifre hatalı. Lütfen bilgilerinizi kontrol edin.',
    'auth/user-disabled':
      'Bu kullanıcı hesabı devre dışı bırakılmıştır. Lütfen destek ekibiyle iletişime geçin.',
    'auth/too-many-requests':
      'Çok fazla başarısız deneme yapıldı. Güvenliğiniz için lütfen birkaç dakika sonra tekrar deneyin.',
    'auth/missing-password':
      'Lütfen şifrenizi giriniz.',

    // Google & Popup Giriş Hataları
    'auth/popup-blocked':
      'Tarayıcınız Google ile oturum açma penceresini (popup) engelledi. Lütfen adres çubuğundaki açılır pencere engeline tıklayarak izin verin ve tekrar deneyin.',
    'auth/popup-closed-by-user':
      'Google oturum açma penceresi işlem tamamlanmadan kapatıldı.',
    'auth/cancelled-popup-request':
      'Zaten açık bir oturum açma penceresi var. Lütfen o pencereyi tamamlayın veya kapatıp tekrar deneyin.',
    'auth/account-exists-with-different-credential':
      'Bu e-posta adresi daha önce farklı bir yöntemle (örneğin e-posta/şifre ile) kaydedilmiş. Lütfen şifrenizle giriş yapın.',
    'auth/operation-not-allowed':
      'Bu oturum açma yöntemi Firebase konsolunda etkinleştirilmemiş. Lütfen yöneticiyle iletişime geçin.',
    'auth/operation-not-supported-in-this-environment':
      'Bu tarayıcı veya ortam Google ile girişi desteklemiyor. Lütfen Chrome, Edge veya Safari gibi standart bir tarayıcıda deneyin.',
    'auth/unauthorized-domain':
      'Bu alan adı Firebase Authentication izinli alanlarında tanımlı değil.',

    // Ağ ve İletişim Hataları
    'auth/network-request-failed':
      'İnternet bağlantınızı kontrol edin. Firebase sunucularına ulaşılamadı.',
    'permission-denied':
      'Veritabanı erişim izni reddedildi (Firestore güvenlik kuralları).',
  };

  if (code && messages[code]) {
    return messages[code];
  }

  if (code) {
    return `Giriş işlemi başarısız oldu (${code}). Lütfen tekrar deneyin.`;
  }

  return err.message || 'İşlem gerçekleştirilemedi. Lütfen tekrar deneyin.';
}
