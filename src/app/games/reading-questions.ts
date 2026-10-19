/**
 * Günün Okuması: three anlama soruları for every Sesli Okuma passage.
 * The first option is not always the answer; `answer` is the option index.
 */
export interface ComprehensionQuestion {
  q: string;
  options: string[];
  answer: number;
}

export const READING_QUESTIONS: Record<string, ComprehensionQuestion[]> = {
  'minik-kedi': [
    { q: 'Kedinin adı ne?', options: ['Lale', 'Mina', 'Ela'], answer: 1 },
    { q: 'Mina ne içer?', options: ['Süt', 'Su', 'Meyve suyu'], answer: 0 },
    { q: 'Mina akşam nerede uyur?', options: ['Bahçede', 'Koltukta', 'Sepetinde'], answer: 2 },
  ],
  'okul-yolu': [
    { q: 'Ela nereye gidiyor?', options: ['Parka', 'Okula', 'Markete'], answer: 1 },
    { q: 'Ela yolda kimi görüyor?', options: ['Ali’yi', 'Annesini', 'Öğretmenini'], answer: 0 },
    { q: 'Öğretmen onları görünce ne yapıyor?', options: ['Kızıyor', 'Şarkı söylüyor', 'Gülümsüyor'], answer: 2 },
  ],
  yagmur: [
    { q: 'Lale yağmuru nereden izliyor?', options: ['Pencereden', 'Kapıdan', 'Balkondan'], answer: 0 },
    { q: 'Bahçedeki çiçekler ne yapıyor?', options: ['Soluyor', 'Su içiyor', 'Uyuyor'], answer: 1 },
    { q: 'Yağmur dinince gökte ne çıkıyor?', options: ['Ay', 'Yıldız', 'Gökkuşağı'], answer: 2 },
  ],
  'annemle-kek': [
    { q: 'Anne ile çocuk ne yaptı?', options: ['Kek', 'Çorba', 'Pilav'], answer: 0 },
    { q: 'Kek nerede kabardı?', options: ['Tencerede', 'Fırında', 'Tavada'], answer: 1 },
    { q: 'Kekten kime ayırdılar?', options: ['Dedeye', 'Kardeşe', 'Babaya'], answer: 2 },
  ],
  'kaplumbaga-tosbik': [
    { q: 'Tosbik nasıl bir kaplumbağaydı?', options: ['Çok hızlı', 'Çok yavaş', 'Çok büyük'], answer: 1 },
    { q: 'Tosbik yolda kime yardım etti?', options: ['Yavru kuşa', 'Tavşana', 'Bir balığa'], answer: 0 },
    { q: 'Göle en son varan Tosbik nasıl hissetti?', options: ['Üzgün', 'Kızgın', 'En mutlu'], answer: 2 },
  ],
  'kutuphanede-bir-gun': [
    { q: 'Sınıf nereye gitti?', options: ['Müzeye', 'Okul kütüphanesine', 'Hayvanat bahçesine'], answer: 1 },
    { q: 'Can hangi konuda kitap aldı?', options: ['Dinozorlar', 'Uzay', 'Denizler'], answer: 0 },
    { q: 'Kitaplar ne zaman geri getirilecek?', options: ['Yarın', 'Bir ay sonra', 'İki hafta sonra'], answer: 2 },
  ],
  'dedemin-bahcesi': [
    { q: 'Dedenin bahçesi nerede?', options: ['Şehirde', 'Köyde', 'Okulda'], answer: 1 },
    { q: 'Sabah erkenden ne yaptılar?', options: ['Bitkileri suladılar', 'Ağaç diktiler', 'Çit boyadılar'], answer: 0 },
    { q: 'Dedeye göre toprağa iyi bakarsak ne olur?', options: ['Kurur', 'Değişmez', 'Bol ürün verir'], answer: 2 },
  ],
  'kardan-adam': [
    { q: 'Sabah her yer nasıldı?', options: ['Yemyeşil', 'Bembeyaz', 'Çamurlu'], answer: 1 },
    { q: 'Kardan adamın burnu için ne buldular?', options: ['Havuç', 'Taş', 'Düğme'], answer: 0 },
    { q: 'Kardan adamın boynuna ne sarıldı?', options: ['Şal', 'Kurdele', 'Eski bir atkı'], answer: 2 },
  ],
  'nisan-coskusu': [
    { q: 'Okul neyle süslenmişti?', options: ['Balonlarla', 'Bayraklarla', 'Çiçeklerle'], answer: 1 },
    { q: 'Tören hangi marşla başladı?', options: ['İstiklal Marşı', 'Onuncu Yıl Marşı', 'Gençlik Marşı'], answer: 0 },
    { q: 'Sınıf hangi gösteriyi sundu?', options: ['Tiyatro', 'Koro', 'Halk oyunları'], answer: 2 },
  ],
  'arilarin-emegi': [
    { q: 'Bir kovanda kaç arı yaşar?', options: ['Birkaç', 'Binlerce', 'On tane'], answer: 1 },
    { q: 'Arılar nektarı neye dönüştürür?', options: ['Bala', 'Süte', 'Polene'], answer: 0 },
    { q: 'Metne göre arıları neden korumalıyız?', options: ['Çok güzel oldukları için', 'Sessiz oldukları için', 'Meyvelerin oluşmasına yardım ettikleri için'], answer: 2 },
  ],
  'kayip-yavru': [
    { q: 'Yavru köpek nerede bulundu?', options: ['Okulda', 'Parkın köşesinde', 'Evin önünde'], answer: 1 },
    { q: 'Sahibini bulmaya ne yardım etti?', options: ['Tasmadaki telefon numarası', 'Bir afiş', 'Komşular'], answer: 0 },
    { q: 'Köpeğin adı neydi?', options: ['Pamuk', 'Karabaş', 'Fındık'], answer: 2 },
  ],
  'dort-mevsim': [
    { q: 'Bir yılda kaç mevsim vardır?', options: ['İki', 'Dört', 'Altı'], answer: 1 },
    { q: 'Hangi mevsimde yapraklar sararır?', options: ['Sonbaharda', 'İlkbaharda', 'Yazın'], answer: 0 },
    { q: 'Metne göre kışın günler nasıl olur?', options: ['Uzar', 'Değişmez', 'Kısalır'], answer: 2 },
  ],
  'cocuklarin-bayrami': [
    { q: 'Türkiye Büyük Millet Meclisi nerede açıldı?', options: ['İstanbul’da', 'Ankara’da', 'İzmir’de'], answer: 1 },
    { q: 'Atatürk 23 Nisan’ı kimlere armağan etti?', options: ['Çocuklara', 'Öğretmenlere', 'Askerlere'], answer: 0 },
    { q: 'Farklı ülkelerin çocukları birlikte neyi gösteriyor?', options: ['Yarışmanın önemini', 'Kimin daha iyi dans ettiğini', 'Barışın ve dostluğun güzelliğini'], answer: 2 },
  ],
  leylekler: [
    { q: 'Leylekler yuvalarını nereye yapmış?', options: ['Bir ağaca', 'Eski okulun bacasına', 'Caminin minaresine'], answer: 1 },
    { q: 'Leylekler kışı nerede geçirir?', options: ['Sıcak Afrika ülkelerinde', 'Karlı dağlarda', 'Köyde'], answer: 0 },
    { q: 'Yuvayı neyle onarırlar?', options: ['Taş ve kumla', 'Yaprak ve tüyle', 'Dal, ot ve çamurla'], answer: 2 },
  ],
  'sahil-temizligi': [
    { q: 'Öğretmen herkese ne dağıttı?', options: ['Şapka ve su', 'Eldiven ve torba', 'Kova ve kürek'], answer: 1 },
    { q: 'Balıkçı plastikler hakkında ne anlattı?', options: ['Yüzlerce yıl yok olmadığını', 'Hemen eridiğini', 'Balıklara yararlı olduğunu'], answer: 0 },
    { q: 'Çocuklar sonunda hangi kararı aldı?', options: ['Bir daha sahile gitmemeyi', 'Daha çok plastik toplamayı', 'Bez çanta ve matara taşımayı'], answer: 2 },
  ],
  'bilim-senligi': [
    { q: 'Anlatıcının grubu ne yaptı?', options: ['Yanardağ', 'Limon pili', 'Su roketi'], answer: 1 },
    { q: 'Işık yanınca ne oldu?', options: ['Herkes alkışladı', 'Sigorta attı', 'Limonlar çürüdü'], answer: 0 },
    { q: 'Metnin son cümlesine göre kim küçük bir bilim insanıdır?', options: ['Yalnızca öğretmenler', 'Deneyi kazananlar', 'Merak eden ve deneyen herkes'], answer: 2 },
  ],
};

export function questionsFor(textId: string): ComprehensionQuestion[] {
  return READING_QUESTIONS[textId] ?? [];
}

/** Today's passage for a grade: rotates through the grade's texts day by day. */
export function dailyTextIndex(date: Date, count: number): number {
  if (count <= 0) return 0;
  const start = Date.UTC(date.getFullYear(), 0, 1);
  const day = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - start) / 86_400_000);
  return day % count;
}

/** Silent reading speed in words per minute. */
export function wordsPerMinute(words: number, ms: number): number {
  if (ms <= 0) return 0;
  return Math.round((words / ms) * 60_000);
}
