/**
 * Sesli Okuma Koçu: short original passages for 1-4. sınıf, four per grade.
 * Written for this app (not taken from textbooks). Grade 1 keeps sentences
 * very short with common syllable patterns; later grades grow longer.
 */
export interface ReadingText {
  id: string;
  grade: 1 | 2 | 3 | 4;
  title: string;
  emoji: string;
  text: string;
}

/** Doğru kelime/dakika range a reader of this grade aims for by the end of the year. */
export interface SpeedBand {
  min: number;
  max: number;
}

/**
 * Rough end-of-year targets in doğru kelime/dakika. These are approximate
 * guidance values that are commonly cited for Turkish reading fluency
 * (they vary by study, text and child); they are NOT official MEB norms.
 * The app only uses them to give gentle feedback, never to grade a child.
 */
export const SPEED_BANDS: Record<1 | 2 | 3 | 4, SpeedBand> = {
  1: { min: 40, max: 60 },
  2: { min: 70, max: 90 },
  3: { min: 90, max: 110 },
  4: { min: 110, max: 130 },
};

/** Allowed passage length (word count) per grade. */
export const WORD_RANGE: Record<1 | 2 | 3 | 4, SpeedBand> = {
  1: { min: 15, max: 30 },
  2: { min: 30, max: 50 },
  3: { min: 50, max: 80 },
  4: { min: 80, max: 120 },
};

export const READING_TEXTS: ReadingText[] = [
  // ---- 1. sınıf -------------------------------------------------------------
  {
    id: 'minik-kedi',
    grade: 1,
    title: 'Minik Kedi',
    emoji: '🐱',
    text: 'Bu kedi Mina. Mina minik bir kedi. Mina süt içer. Top ile oynar. Akşam olunca sepetinde uyur.',
  },
  {
    id: 'okul-yolu',
    grade: 1,
    title: 'Okul Yolu',
    emoji: '🎒',
    text: 'Ela okula gidiyor. Çantası sırtında. Yolda Ali’yi görüyor. İkisi el ele yürüyor. Okulun kapısı açık. Öğretmen onlara gülümsüyor.',
  },
  {
    id: 'yagmur',
    grade: 1,
    title: 'Yağmur',
    emoji: '🌧️',
    text: 'Bak, yağmur yağıyor. Damla damla iniyor. Lale pencereden bakıyor. Bahçedeki çiçekler su içiyor. Yağmur dinince gökte bir gökkuşağı çıkıyor. Lale çok seviniyor.',
  },
  {
    id: 'annemle-kek',
    grade: 1,
    title: 'Annemle Kek',
    emoji: '🍰',
    text: 'Annemle kek yaptık. Una yumurta ekledik. Biraz süt de koyduk. Kek fırında kabardı. Evi güzel bir koku sardı. Kekten babama da ayırdık.',
  },

  // ---- 2. sınıf -------------------------------------------------------------
  {
    id: 'kaplumbaga-tosbik',
    grade: 2,
    title: 'Kaplumbağa Tosbik',
    emoji: '🐢',
    text:
      'Tosbik çok yavaş yürüyen bir kaplumbağaydı. Bir gün arkadaşları göle gitmeye karar verdi. ' +
      'Tavşan koştu, kuş uçtu, Tosbik yürüdü. Yolda yuvasından düşmüş bir yavru kuş gördü. ' +
      'Tosbik durup ona yardım etti. Göle en son o vardı ama en mutlu da o oldu.',
  },
  {
    id: 'kutuphanede-bir-gun',
    grade: 2,
    title: 'Kütüphanede Bir Gün',
    emoji: '📚',
    text:
      'Bugün sınıfça okul kütüphanesine gittik. Raflar renkli kitaplarla doluydu. ' +
      'Ben uzay hakkında bir kitap seçtim. Kitapta gezegenlerin resimleri vardı. ' +
      'Arkadaşım Can ise dinozorları anlatan bir kitap aldı. Okuduklarımızı birbirimize anlattık. ' +
      'Kitapları iki hafta sonra geri getireceğiz.',
  },
  {
    id: 'dedemin-bahcesi',
    grade: 2,
    title: 'Dedemin Bahçesi',
    emoji: '🍅',
    text:
      'Dedemin köyde küçük bir bahçesi var. Bahçede domates, biber ve fasulye yetişiyor. ' +
      'Sabah erkenden dedemle bitkileri suladık. Sonra kırmızı domatesleri topladık. ' +
      'Dedem, toprağa iyi bakarsak bize bol ürün verir, dedi. ' +
      'Akşam yemeğinde kendi domateslerimizi yedik.',
  },
  {
    id: 'kardan-adam',
    grade: 2,
    title: 'Kardan Adam',
    emoji: '⛄',
    text:
      'Sabah uyandığımda her yer bembeyazdı. Kardeşimle hemen bahçeye koştuk. ' +
      'Önce büyük bir kar topu yuvarladık. Üstüne daha küçük bir top koyduk. ' +
      'Gözleri için iki taş, burnu için bir havuç bulduk. Babam da boynuna eski atkısını sardı. ' +
      'Kardan adamımız çok sevimli oldu.',
  },

  // ---- 3. sınıf -------------------------------------------------------------
  {
    id: 'nisan-coskusu',
    grade: 3,
    title: '23 Nisan Coşkusu',
    emoji: '🇹🇷',
    text:
      '23 Nisan sabahı okulumuz bayraklarla süslenmişti. Bütün öğrenciler bahçede toplandı. ' +
      'Önce İstiklal Marşı’nı hep birlikte söyledik. Sonra müdürümüz kısa bir konuşma yaptı. ' +
      'Bu bayramı çocuklara Atatürk’ün armağan ettiğini anlattı. ' +
      'Ardından sınıfımız halk oyunları gösterisi sundu. Ben çok heyecanlıydım ama hiç hata yapmadım. ' +
      'Gösteriden sonra arkadaşlarımla şiirler okuduk, şarkılar söyledik. ' +
      'Eve dönerken bayrağımı elimden hiç bırakmadım.',
  },
  {
    id: 'arilarin-emegi',
    grade: 3,
    title: 'Arıların Emeği',
    emoji: '🐝',
    text:
      'Bal arıları çok çalışkan böceklerdir. Bir kovanda binlerce arı birlikte yaşar. ' +
      'Her arının bir görevi vardır. Bazıları çiçeklerden çiçeklere uçarak nektar toplar. ' +
      'Bazıları kovanı temizler, bazıları da yavrulara bakar. ' +
      'Arılar topladıkları nektarı kovanda bala dönüştürür. ' +
      'Bir kavanoz bal için arıların milyonlarca çiçeği ziyaret etmesi gerekir. ' +
      'Arılar çiçekten çiçeğe giderken meyvelerin oluşmasına da yardım eder. ' +
      'Bu yüzden arıları korumalıyız.',
  },
  {
    id: 'kayip-yavru',
    grade: 3,
    title: 'Kayıp Yavru',
    emoji: '🐶',
    text:
      'Okuldan dönerken parkın köşesinde titreyen küçük bir köpek yavrusu gördüm. ' +
      'Boynunda mavi bir tasma vardı. Hemen eve koşup anneme haber verdim. ' +
      'Birlikte yavruya ılık su ve biraz yemek götürdük. Tasmanın üstünde bir telefon numarası yazıyordu. ' +
      'Annem numarayı aradı. Yarım saat sonra küçük bir kız ve babası geldi. ' +
      'Kız yavrusunu görünce sevinçten ağladı. Bana teşekkür etti ve köpeğin adının Fındık olduğunu söyledi.',
  },
  {
    id: 'dort-mevsim',
    grade: 3,
    title: 'Dört Mevsim',
    emoji: '🍂',
    text:
      'Bir yılda dört mevsim vardır. İlkbaharda ağaçlar çiçek açar, kuşlar yuva yapar. ' +
      'Yazın günler uzar, hava ısınır. Çocuklar denize girer, bahçede oynar. ' +
      'Sonbaharda yapraklar sararır ve yere düşer. Okullar açılır, rüzgâr serinler. ' +
      'Kışın kar yağar, günler kısalır. Sıcak evlerimizde ailemizle vakit geçiririz. ' +
      'Her mevsimin kendine özgü bir güzelliği vardır. Sen en çok hangi mevsimi seviyorsun?',
  },

  // ---- 4. sınıf -------------------------------------------------------------
  {
    id: 'cocuklarin-bayrami',
    grade: 4,
    title: 'Çocukların Bayramı',
    emoji: '🎈',
    text:
      '23 Nisan 1920 günü Ankara’da Türkiye Büyük Millet Meclisi açıldı. ' +
      'Bu meclis, milletin kendi kararlarını kendisinin verdiği yerdi. ' +
      'Atatürk çocukları çok severdi ve onlara güvenirdi. ' +
      'Geleceği çocukların kuracağına inanırdı. Bu yüzden 23 Nisan’ı çocuklara bayram olarak armağan etti. ' +
      'Bugün bu bayramı dünyanın pek çok ülkesinden gelen çocuklarla birlikte kutluyoruz. ' +
      'Farklı dilleri konuşan çocuklar aynı sahnede şarkı söylüyor, dans ediyor. ' +
      'Böylece barışın ve dostluğun ne kadar güzel olduğunu herkese gösteriyorlar. ' +
      'Biz de bu armağana layık olmak için çok okumalı, birbirimizi sevmeli ve saymalıyız.',
  },
  {
    id: 'leylekler',
    grade: 4,
    title: 'Leyleklerin Yolculuğu',
    emoji: '🪶',
    text:
      'Her ilkbaharda köyümüzdeki eski okulun bacasına bir leylek çifti gelir. ' +
      'Dedem onların her yıl aynı yuvaya döndüğünü söyler. ' +
      'Leylekler kışı sıcak Afrika ülkelerinde geçirir. Havalar ısınınca binlerce kilometre uçarak geri gelirler. ' +
      'Uzun yolculukta yönlerini nasıl buldukları bilim insanlarının da ilgisini çeker. ' +
      'Leylekler yuvalarını dallarla, otlarla ve çamurla onarır. Sonra yumurtalarından yavrular çıkar. ' +
      'Anne ve baba leylek yavrularını sırayla besler. Yaz sonunda yavrular uçmayı öğrenir. ' +
      'Bir sabah gökyüzünde büyük bir sürü toplanır ve hepsi birlikte güneye doğru yola çıkar. ' +
      'Biz de gelecek baharda onları yeniden görmeyi bekleriz.',
  },
  {
    id: 'sahil-temizligi',
    grade: 4,
    title: 'Sahil Temizliği',
    emoji: '🌊',
    text:
      'Geçen cumartesi sınıfça sahil temizliğine katıldık. Öğretmenimiz herkese eldiven ve torba dağıttı. ' +
      'Kumların arasında plastik şişeler, poşetler ve şişe kapakları bulduk. ' +
      'Bir balıkçı bize denize atılan plastiklerin yüzlerce yıl yok olmadığını anlattı. ' +
      'Bu atıkları balıkların ve kaplumbağaların yiyecek sandığını öğrenince çok üzüldük. ' +
      'İki saat içinde tam on iki torba doldurduk. Topladıklarımızı geri dönüşüm kutularına ayırdık. ' +
      'Çalışma bitince sahil pırıl pırıl olmuştu. Martılar başımızın üstünde mutlu mutlu uçuyordu. ' +
      'O gün bir karar aldık: Bundan sonra yanımızda her zaman bir bez çanta ve su matarası taşıyacağız.',
  },
  {
    id: 'bilim-senligi',
    grade: 4,
    title: 'Bilim Şenliği',
    emoji: '🔬',
    text:
      'Okulumuzda bilim şenliği düzenlendi. Her grup bir deney hazırladı. ' +
      'Biz grup olarak limon pili yapmaya karar verdik. Dört limona bakır ve çinko parçaları batırdık. ' +
      'Parçaları kablolarla birbirine bağladık. Sonra uçlara küçük bir ışık taktık. ' +
      'Işık yanınca sınıftaki herkes alkışladı. Ziyaretçilere limonun içindeki asidin elektrik akımı oluşturmaya yardım ettiğini anlattık. ' +
      'Yan masadaki grup ise sirke ve karbonatla bir yanardağ yaptı. Köpükler taşınca küçük kardeşler kahkahalarla güldü. ' +
      'Günün sonunda hepimiz bir şey öğrendik: Merak eden ve deneyen herkes küçük bir bilim insanıdır.',
  },
];

export function readingTextById(id: string): ReadingText | undefined {
  return READING_TEXTS.find((t) => t.id === id);
}

export function readingTextsForGrade(grade: number): ReadingText[] {
  return READING_TEXTS.filter((t) => t.grade === grade);
}
