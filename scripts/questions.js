/**
 * Comprehensive MEB & ÖSYM Curriculum Questions for OdivonSchool.
 * Every question has:
 * - 4 options (a, b, c, d)
 * - correctOptionId
 * - Pedagogical step-by-step explanation
 * - Difficulty rating (1 to 5)
 * Keyed by categoryId (matching scripts/categories.js).
 */
const SAMPLE_QUESTIONS = {
  // ==========================================
  // 1. İLKOKUL (1, 2, 3 ve 4. Sınıflar)
  // ==========================================
  'ilkokul-matematik-dogal-sayilar': [
    {
      prompt: '458 sayısındaki "5" rakamının basamak değeri kaçtır?',
      options: [
        { id: 'a', text: '5' },
        { id: 'b', text: '50' },
        { id: 'c', text: '500' },
        { id: 'd', text: '58' },
      ],
      correctOptionId: 'b',
      explanation: '458 sayısında 8 birler, 5 onlar, 4 yüzler basamağındadır. Onlar basamağındaki 5 rakamının basamak değeri 5 x 10 = 50 olur.',
      difficulty: 1,
    },
    {
      prompt: 'Yüzler basamağında 7, birler basamağında 3 ve onlar basamağında 0 olan üç basamaklı sayı hangisidir?',
      options: [
        { id: 'a', text: '730' },
        { id: 'b', text: '307' },
        { id: 'c', text: '703' },
        { id: 'd', text: '370' },
      ],
      correctOptionId: 'c',
      explanation: 'Yüzler basamağı = 7 (700), Onlar basamağı = 0 (0), Birler basamağı = 3 (3). Sayı: 703\'tür.',
      difficulty: 1,
    },
  ],

  'ilkokul-matematik-toplama-cikarma': [
    {
      prompt: '24 + 18 işleminin sonucu kaçtır?',
      options: [
        { id: 'a', text: '32' },
        { id: 'b', text: '42' },
        { id: 'c', text: '52' },
        { id: 'd', text: '46' },
      ],
      correctOptionId: 'b',
      explanation: 'Önce birler basamağı toplanır: 4 + 8 = 12 (elde 1 var). Onlar basamağı: 2 + 1 = 3, elde 1 ile 4 eder. Sonuç 42\'dir.',
      difficulty: 1,
    },
    {
      prompt: 'Ayşe\'nin 62 lirası vardı. 27 lirasını kırtasiyede harcadı. Geriye kaç lirası kaldı?',
      options: [
        { id: 'a', text: '35' },
        { id: 'b', text: '45' },
        { id: 'c', text: '37' },
        { id: 'd', text: '25' },
      ],
      correctOptionId: 'a',
      explanation: '62 - 27 işleminde: 2\'den 7 çıkmaz, onluk bozulur. 12 - 7 = 5. Onlar basamağında 5 kaldı; 5 - 2 = 3. Sonuç 35 TL kalır.',
      difficulty: 2,
    },
  ],

  'ilkokul-matematik-carpma-bolme': [
    {
      prompt: 'Bir sınıfta 8 sıra vardır. Her sırada 3 öğrenci oturduğuna göre sınıfta toplam kaç öğrenci vardır?',
      options: [
        { id: 'a', text: '21' },
        { id: 'b', text: '24' },
        { id: 'c', text: '27' },
        { id: 'd', text: '18' },
      ],
      correctOptionId: 'b',
      explanation: 'Sıra sayısı ile sıradaki öğrenci sayısı çarpılır: 8 x 3 = 24 öğrenci vardır.',
      difficulty: 1,
    },
    {
      prompt: '48 fındık 4 kardeş arasında eşit olarak paylaştırılırsa her birine kaç fındık düşer?',
      options: [
        { id: 'a', text: '10' },
        { id: 'b', text: '11' },
        { id: 'c', text: '12' },
        { id: 'd', text: '14' },
      ],
      correctOptionId: 'c',
      explanation: 'Eşit paylaştırma bölme işlemidir: 48 ÷ 4 = 12 fındık düşer.',
      difficulty: 1,
    },
  ],

  'ilkokul-matematik-kesirler': [
    {
      prompt: 'Bir pastanın 4 eş diliminden 3 dilimini yiyen Ahmet, pastanın kaçta kaçını yemiştir?',
      options: [
        { id: 'a', text: '1/4' },
        { id: 'b', text: '3/4' },
        { id: 'c', text: '4/3' },
        { id: 'd', text: '2/4' },
      ],
      correctOptionId: 'b',
      explanation: 'Tüm parça sayısı payda (4), yenilen miktar pay (3) olur. Kesir 3/4 şeklinde ifade edilir.',
      difficulty: 1,
    },
    {
      prompt: 'Aşağıdaki kesirlerden hangisi birim kesirdir?',
      options: [
        { id: 'a', text: '1/6' },
        { id: 'b', text: '2/5' },
        { id: 'c', text: '4/4' },
        { id: 'd', text: '3/7' },
      ],
      correctOptionId: 'a',
      explanation: 'Payı 1 olan kesirlere "birim kesir" denir. 1/6 kesrinin payı 1 olduğu için birim kesirdir.',
      difficulty: 2,
    },
  ],

  'ilkokul-matematik-geometri': [
    {
      prompt: 'Bir küpün kaç tane yüzü (yüzeyi) vardır?',
      options: [
        { id: 'a', text: '4' },
        { id: 'b', text: '6' },
        { id: 'c', text: '8' },
        { id: 'd', text: '12' },
      ],
      correctOptionId: 'b',
      explanation: 'Küpün 6 adet birbirine eş karesel yüzeyi, 8 köşesi ve 12 ayrıtı vardır.',
      difficulty: 1,
    },
  ],

  'ilkokul-matematik-olcmeler-ve-paralar': [
    {
      prompt: 'Saat 14:15\'te başlayan bir çizgi film 45 dakika sürmüştür. Çizgi film bittiğinde saat kaçı gösterir?',
      options: [
        { id: 'a', text: '14:45' },
        { id: 'b', text: '15:00' },
        { id: 'c', text: '15:15' },
        { id: 'd', text: '15:30' },
      ],
      correctOptionId: 'b',
      explanation: '14:15 + 45 dakika: 15 + 45 = 60 dakika (1 saat). 14:00 + 1 saat = 15:00 eder.',
      difficulty: 2,
    },
  ],

  'ilkokul-turkce-okudugunu-anlama': [
    {
      prompt: '"Ali her sabah erken kalkar, bahçedeki çiçekleri sular ve sonra okuluna giderdi." Bu cümleye göre Ali okuldan önce ne yapardı?',
      options: [
        { id: 'a', text: 'Televizyon izlerdi' },
        { id: 'b', text: 'Kitap okurdu' },
        { id: 'c', text: 'Çiçekleri sulardı' },
        { id: 'd', text: 'Kahvaltı hazırlardı' },
      ],
      correctOptionId: 'c',
      explanation: 'Metinde Ali\'nin erken kalkıp bahçedeki çiçekleri suladığı, ardından okula gittiği açıkça belirtilmiştir.',
      difficulty: 1,
    },
  ],

  'ilkokul-turkce-es-zit-anlam': [
    {
      prompt: '"Hızlı" kelimesinin zıt (karşıt) anlamlısı aşağıdakilerden hangisidir?',
      options: [
        { id: 'a', text: 'Süratli' },
        { id: 'b', text: 'Yavaş' },
        { id: 'c', text: 'Çabuk' },
        { id: 'd', text: 'Acele' },
      ],
      correctOptionId: 'b',
      explanation: 'Hızlı kelimesinin eş anlamlısı süratli, zıt (karşıt) anlamlısı ise "yavaş"tır.',
      difficulty: 1,
    },
    {
      prompt: '"Mektep" sözcüğünün eş anlamlısı aşağıdakilerden hangisidir?',
      options: [
        { id: 'a', text: 'Öğretmen' },
        { id: 'b', text: 'Okul' },
        { id: 'c', text: 'Sınıf' },
        { id: 'd', text: 'Kitap' },
      ],
      correctOptionId: 'b',
      explanation: 'Mektep ve okul aynı anlama gelen eş anlamlı (anlamdaş) sözcüklerdir.',
      difficulty: 1,
    },
  ],

  'ilkokul-turkce-yazim-noktalama': [
    {
      prompt: 'Aşağıdaki cümlelerin hangisinin sonuna soru işareti (?) konulmalıdır?',
      options: [
        { id: 'a', text: 'Yarın bize gelecek misin' },
        { id: 'b', text: 'Hava bugün çok güzel' },
        { id: 'c', text: 'Eyvah, servis kaçtı' },
        { id: 'd', text: 'Ödevlerimi bitirdim' },
      ],
      correctOptionId: 'a',
      explanation: '"Yarın bize gelecek misin?" cümlesi bir soru bildirdiği için sonuna soru işareti gelmelidir.',
      difficulty: 1,
    },
  ],

  'ilkokul-turkce-atasozleri-deyimler': [
    {
      prompt: '"Damlaya damlaya ... olur." atasözündeki boşluğa hangi kelime gelmelidir?',
      options: [
        { id: 'a', text: 'ırmak' },
        { id: 'b', text: 'deniz' },
        { id: 'c', text: 'göl' },
        { id: 'd', text: 'yağmur' },
      ],
      correctOptionId: 'c',
      explanation: 'Atasözünün doğrusu "Damlaya damlaya göl olur" şeklindedir ve tutumluluğun, birikimin önemini anlatır.',
      difficulty: 1,
    },
  ],

  'ilkokul-fen-yer-kabugu-ve-dunya': [
    {
      prompt: 'Dünya\'nın kendi ekseni etrafında bir tam tur dönmesiyle hangisi oluşur?',
      options: [
        { id: 'a', text: 'Mevsimler' },
        { id: 'b', text: 'Bir yıl' },
        { id: 'c', text: 'Gece ve gündüz' },
        { id: 'd', text: 'Ay tutulması' },
      ],
      correctOptionId: 'c',
      explanation: 'Dünya kendi ekseni etrafındaki dönüşünü 24 saatte tamamlar ve bunun sonucunda gece ve gündüz oluşur. Güneş etrafında dolanmasıyla ise mevsimler oluşur.',
      difficulty: 1,
    },
  ],

  'ilkokul-fen-besinlerimiz': [
    {
      prompt: 'Vücudumuzda yapıcı ve onarıcı olarak görev yapan, büyüme ve yaraların iyileşmesini sağlayan temel besin grubu hangisidir?',
      options: [
        { id: 'a', text: 'Karbonhidratlar' },
        { id: 'b', text: 'Proteinler' },
        { id: 'c', text: 'Yağlar' },
        { id: 'd', text: 'Su ve mineraller' },
      ],
      correctOptionId: 'b',
      explanation: 'Proteinler (et, süt, yumurta, balık, baklagiller) vücudumuzun yapıcı ve onarıcı temel yapı taşlarıdır.',
      difficulty: 2,
    },
  ],

  'ilkokul-fen-kuvvet-ve-hareket': [
    {
      prompt: 'Hareket halindeki bir topa hareket yönünün tersi yönünde kuvvet uygulanırsa top nasıl bir hareket yapar?',
      options: [
        { id: 'a', text: 'Hızlanır' },
        { id: 'b', text: 'Yavaşlar veya durur' },
        { id: 'c', text: 'Yönü değişmeden hızlanır' },
        { id: 'd', text: 'Hiçbir değişiklik olmaz' },
      ],
      correctOptionId: 'b',
      explanation: 'Hareket yönüne zıt yönde uygulanan kuvvet cisimleri yavaşlatır veya tamamen durdurur.',
      difficulty: 1,
    },
  ],

  'ilkokul-sosyal-birey-ve-toplum': [
    {
      prompt: 'Türkiye Cumhuriyeti kimlik kartımızda yer alan T.C. Kimlik Numarası kaç basamaklıdır?',
      options: [
        { id: 'a', text: '9' },
        { id: 'b', text: '10' },
        { id: 'c', text: '11' },
        { id: 'd', text: '12' },
      ],
      correctOptionId: 'c',
      explanation: 'T.C. Kimlik Numarası her vatandaşa özel, benzersiz ve 11 hanelidir.',
      difficulty: 1,
    },
  ],

  // ==========================================
  // 2. ORTAOKUL (5, 6, 7 ve 8. Sınıf & LGS)
  // ==========================================
  'ortaokul-matematik-carpanlar-katlar': [
    {
      prompt: '24 ve 36 sayılarının En Büyük Ortak Böleni (EBOB) kaçtır?',
      options: [
        { id: 'a', text: '6' },
        { id: 'b', text: '12' },
        { id: 'c', text: '18' },
        { id: 'd', text: '72' },
      ],
      correctOptionId: 'b',
      explanation: '24\'ün bölenleri: 1, 2, 3, 4, 6, 8, 12, 24. 36\'nın bölenleri: 1, 2, 3, 4, 6, 9, 12, 18, 36. Ortak olanların en büyüğü 12\'dir. EBOB(24, 36) = 12.',
      difficulty: 2,
    },
    {
      prompt: 'Aralarında asal iki sayının EBOB\'u her zaman kaça eşittir?',
      options: [
        { id: 'a', text: '0' },
        { id: 'b', text: '1' },
        { id: 'c', text: 'Bu sayıların çarpımına' },
        { id: 'd', text: 'Sayıların toplamına' },
      ],
      correctOptionId: 'b',
      explanation: 'Aralarında asal sayıların 1\'den başka ortak pozitif böleni yoktur. Bu yüzden EBOB\'ları her zaman 1\'dir.',
      difficulty: 1,
    },
  ],

  'ortaokul-matematik-uslu-ifadeler': [
    {
      prompt: '2³ x 2⁵ işleminin sonucu hangisidir?',
      options: [
        { id: 'a', text: '2⁸' },
        { id: 'b', text: '2¹⁵' },
        { id: 'c', text: '4⁸' },
        { id: 'd', text: '4¹⁵' },
      ],
      correctOptionId: 'a',
      explanation: 'Tabanları aynı olan üslü ifadeler çarpılırken üsler toplanır: 2^(3 + 5) = 2⁸.',
      difficulty: 1,
    },
    {
      prompt: '5⁻² ifadesinin değeri kaçtır?',
      options: [
        { id: 'a', text: '-10' },
        { id: 'b', text: '-25' },
        { id: 'c', text: '1/25' },
        { id: 'd', text: '1/10' },
      ],
      correctOptionId: 'c',
      explanation: 'Negatif üs, tabanın çarpmaya göre tersini aldırır: 5⁻² = 1 / 5² = 1 / 25.',
      difficulty: 2,
    },
  ],

  'ortaokul-matematik-karekoklu-ifadeler': [
    {
      prompt: '√72 sayısı a√b şeklinde yazıldığında en sade hali hangisidir?',
      options: [
        { id: 'a', text: '2√6' },
        { id: 'b', text: '3√8' },
        { id: 'c', text: '6√2' },
        { id: 'd', text: '4√3' },
      ],
      correctOptionId: 'c',
      explanation: '72 = 36 x 2 olarak çarpanlarına ayrılır. √72 = √(36 x 2) = 6√2.',
      difficulty: 2,
    },
    {
      prompt: '√48 + √12 işleminin sonucu kaçtır?',
      options: [
        { id: 'a', text: '√60' },
        { id: 'b', text: '6√3' },
        { id: 'c', text: '4√3' },
        { id: 'd', text: '8√3' },
      ],
      correctOptionId: 'b',
      explanation: '√48 = √(16 x 3) = 4√3 ve √12 = √(4 x 3) = 2√3. Toplam: 4√3 + 2√3 = 6√3.',
      difficulty: 3,
    },
  ],

  'ortaokul-matematik-olasilik-ve-veri': [
    {
      prompt: 'Hilesiz bir zar atıldığında üst yüze gelen sayının asal sayı olma olasılığı kaçtır?',
      options: [
        { id: 'a', text: '1/6' },
        { id: 'b', text: '1/3' },
        { id: 'c', text: '1/2' },
        { id: 'd', text: '2/3' },
      ],
      correctOptionId: 'c',
      explanation: 'Zardaki olası tüm durumlar: {1, 2, 3, 4, 5, 6} (6 adet). Asal sayılar: {2, 3, 5} (3 adet). Olasılık = 3/6 = 1/2.',
      difficulty: 2,
    },
  ],

  'ortaokul-matematik-cebir-ve-ozdeslikler': [
    {
      prompt: '(x + 3)² cebirsel ifadesinin özdeşi aşağıdakilerden hangisidir?',
      options: [
        { id: 'a', text: 'x² + 9' },
        { id: 'b', text: 'x² + 3x + 9' },
        { id: 'c', text: 'x² + 6x + 9' },
        { id: 'd', text: '2x + 6' },
      ],
      correctOptionId: 'c',
      explanation: 'Tam kare açılımı kuralı: (a + b)² = a² + 2ab + b². Buradan (x + 3)² = x² + 2(x)(3) + 3² = x² + 6x + 9.',
      difficulty: 2,
    },
    {
      prompt: 'x² - 16 ifadesinin çarpanlarına ayrılmış hali hangisidir?',
      options: [
        { id: 'a', text: '(x - 4)(x + 4)' },
        { id: 'b', text: '(x - 8)(x + 8)' },
        { id: 'c', text: '(x - 4)²' },
        { id: 'd', text: '(x + 4)²' },
      ],
      correctOptionId: 'a',
      explanation: 'İki kare farkı kuralı: a² - b² = (a - b)(a + b). x² - 4² = (x - 4)(x + 4).',
      difficulty: 2,
    },
  ],

  'ortaokul-matematik-denklemler-ve-grafikler': [
    {
      prompt: '2x - 5 = 11 denklemini sağlayan x değeri kaçtır?',
      options: [
        { id: 'a', text: '3' },
        { id: 'b', text: '6' },
        { id: 'c', text: '8' },
        { id: 'd', text: '16' },
      ],
      correctOptionId: 'c',
      explanation: '2x = 11 + 5 => 2x = 16 => x = 8.',
      difficulty: 1,
    },
    {
      prompt: 'y = 3x - 4 doğrusunun eğimi kaçtır?',
      options: [
        { id: 'a', text: '3' },
        { id: 'b', text: '-4' },
        { id: 'c', text: '4/3' },
        { id: 'd', text: '-3' },
      ],
      correctOptionId: 'a',
      explanation: 'y = mx + n biçiminde verilen doğru denklemlerinde x\'in katsayısı (m) doğrunun eğimidir. Eğim = 3.',
      difficulty: 2,
    },
  ],

  'ortaokul-turkce-fiilimsiler': [
    {
      prompt: '"Koşan çocukları izlemek bana büyük bir mutluluk veriyor." cümlesindeki fiilimsiler sırasıyla hangi türdendir?',
      options: [
        { id: 'a', text: 'Sıfat-fiil, İsim-fiil' },
        { id: 'b', text: 'Zarf-fiil, İsim-fiil' },
        { id: 'c', text: 'İsim-fiil, Sıfat-fiil' },
        { id: 'd', text: 'Sıfat-fiil, Zarf-fiil' },
      ],
      correctOptionId: 'a',
      explanation: '"Koş-an" (-an eki) sıfat-fiildir (ortaç). "İzle-mek" (-mek eki) isim-fiildir (mastar). Doğru sıralama: Sıfat-fiil, İsim-fiil.',
      difficulty: 2,
    },
    {
      prompt: 'Aşağıdaki altı çizili sözcüklerden hangisi zarf-fiil (bağ-fiil) eki almıştır?',
      options: [
        { id: 'a', text: 'Görünmez kaza geliyorum demez.' },
        { id: 'b', text: 'Gülerek yanımıza doğru yaklaştı.' },
        { id: 'c', text: 'Okuma sevgisi küçük yaşta aşılanır.' },
        { id: 'd', text: 'Tanıdık bir yüze rastlayamadım.' },
      ],
      correctOptionId: 'b',
      explanation: '"Gül-erek" sözcüğündeki "-erek" eki durum bildiren zarf-fiil ekidir ("nasıl yaklaştı? -> gülerek").',
      difficulty: 2,
    },
  ],

  'ortaokul-turkce-cumlenin-ogeleri': [
    {
      prompt: '"Küçük çocuk, elindeki kırmızı elmayı afiyetle yedi." cümlesinin öznesi hangisidir?',
      options: [
        { id: 'a', text: 'yedi' },
        { id: 'b', text: 'afiyetle' },
        { id: 'c', text: 'elindeki kırmızı elmayı' },
        { id: 'd', text: 'Küçük çocuk' },
      ],
      correctOptionId: 'd',
      explanation: 'Yüklem "yedi". Yiyen kim? Sorusunun cevabı "Küçük çocuk"tur, dolayısıyla özne "Küçük çocuk"tur.',
      difficulty: 2,
    },
  ],

  'ortaokul-fen-mevsimler-ve-iklim': [
    {
      prompt: 'Mevsimlerin oluşmasının iki temel sebebi aşağıdakilerden hangisinde doğru verilmiştir?',
      options: [
        { id: 'a', text: 'Dünya\'nın kendi etrafında dönmesi ve Ay\'ın çekim kuvveti' },
        { id: 'b', text: 'Dünya\'nın eksen eğikliği ve Güneş etrafında dolanması' },
        { id: 'c', text: 'Dünya\'nın Güneş\'e olan uzaklığının değişmesi ve atmosfer basıncı' },
        { id: 'd', text: 'Güneş patlamaları ve okyanus akıntıları' },
      ],
      correctOptionId: 'b',
      explanation: 'Mevsimler; Dünya\'nın 23° 27\'lik eksen eğikliği ve Güneş etrafındaki eliptik yörüngede dolanması sayesinde güneş ışınlarının geliş açısının yıl boyunca değişmesiyle oluşur.',
      difficulty: 2,
    },
  ],

  'ortaokul-fen-dna-ve-genetik-kod': [
    {
      prompt: 'DNA molekülünde Adenin (A) nükleotidinin karşısına her zaman hangi nükleotid gelir?',
      options: [
        { id: 'a', text: 'Guanin' },
        { id: 'b', text: 'Sitozin' },
        { id: 'c', text: 'Timin' },
        { id: 'd', text: 'Urasil' },
      ],
      correctOptionId: 'c',
      explanation: 'DNA çift sarmalında Adenin ile Timin (A=T) arasında ikili, Guanin ile Sitozin (G≡S) arasında üçlü hidrojen bağı kurulur.',
      difficulty: 1,
    },
  ],

  'ortaokul-fen-basinc': [
    {
      prompt: 'Katı basıncını artırmak için aşağıdakilerden hangisi yapılmalıdır?',
      options: [
        { id: 'a', text: 'Temas yüzey alanını küçültmek' },
        { id: 'b', text: 'Temas yüzey alanını büyütmek' },
        { id: 'c', text: 'Cismin ağırlığını azaltmak' },
        { id: 'd', text: 'Cismin sıcaklığını artırmak' },
      ],
      correctOptionId: 'a',
      explanation: 'Katı basıncı formülü P = F / S (Ağırlık / Yüzey Alanı) şeklindedir. Yüzey alanı küçüldükçe (bıçakların bilenmesi, çivinin sivri ucu gibi) basınç artar.',
      difficulty: 2,
    },
  ],

  'ortaokul-fen-madde-ve-endustri': [
    {
      prompt: 'pH değeri 2 olan bir çözelti için aşağıdakilerden hangisi doğrudur?',
      options: [
        { id: 'a', text: 'Kuvvetli bir bazdır' },
        { id: 'b', text: 'Nötr bir maddedir' },
        { id: 'c', text: 'Kuvvetli bir asittir ve mavi turnusolu kırmızıya çevirir' },
        { id: 'd', text: 'Kırmızı turnusol kağıdını maviye çevirir' },
      ],
      correctOptionId: 'c',
      explanation: 'pH cetvelinde 0-7 arası asit, 7 nötr, 7-14 arası bazdır. 0\'a yaklaştıkça asitlik kuvveti artar. Asitler mavi turnusol kağıdını kırmızıya çevirir.',
      difficulty: 2,
    },
  ],

  'ortaokul-inkilap-milli-uyanis': [
    {
      prompt: 'Mustafa Kemal\'e "Kemal" adını hangi okuldaki matematik öğretmeni vermiştir?',
      options: [
        { id: 'a', text: 'Şemsi Efendi İlkokulu' },
        { id: 'b', text: 'Selanik Mülkiye Rüştiyesi' },
        { id: 'c', text: 'Selanik Askeri Rüştiyesi' },
        { id: 'd', text: 'Manastır Askeri İdadisi' },
      ],
      correctOptionId: 'c',
      explanation: 'Mustafa Kemal\'e matematik öğretmeni Yüzbaşı Mustafa Bey, Selanik Askeri Rüştiyesi\'nde okurken olgunluk ve bilgi üstünlüğünden dolayı "Kemal" adını vermiştir.',
      difficulty: 2,
    },
  ],

  // ==========================================
  // 3. LİSE (9, 10, 11, 12 ve YKS TYT/AYT)
  // ==========================================
  'lise-matematik-temel-kavramlar': [
    {
      prompt: 'a ve b pozitif tam sayılardır. a . b = 36 olduğuna göre a + b toplamının alabileceği EN KÜÇÜK değer kaçtır?',
      options: [
        { id: 'a', text: '12' },
        { id: 'b', text: '13' },
        { id: 'c', text: '15' },
        { id: 'd', text: '37' },
      ],
      correctOptionId: 'a',
      explanation: 'Çarpımları sabit pozitif sayıların toplamının en küçük olması için sayılar birbirine en yakın seçilmelidir: a = 6, b = 6 için a . b = 36 ve a + b = 12 olur.',
      difficulty: 2,
    },
    {
      prompt: 'x tek tam sayı olduğuna göre aşağıdakilerden hangisi daima ÇİFT sayıdır?',
      options: [
        { id: 'a', text: 'x + 2' },
        { id: 'b', text: 'x² + 1' },
        { id: 'c', text: '3x - 2' },
        { id: 'd', text: '2x + 1' },
      ],
      correctOptionId: 'b',
      explanation: 'x tek ise: x² de tektir. Tek + Tek = Çift olacağından x² + 1 daima çift sayıdır. (Örn: x=3 için 3² + 1 = 10 çifttir).',
      difficulty: 2,
    },
  ],

  'lise-matematik-fonksiyonlar': [
    {
      prompt: 'f(x) = 2x + 3 ve g(x) = x - 1 olduğuna göre (fog)(4) kaçtır?',
      options: [
        { id: 'a', text: '9' },
        { id: 'b', text: '11' },
        { id: 'c', text: '8' },
        { id: 'd', text: '14' },
      ],
      correctOptionId: 'a',
      explanation: '(fog)(4) = f(g(4)). Önce g(4) = 4 - 1 = 3 bulunur. Sonra f(3) = 2(3) + 3 = 6 + 3 = 9 elde edilir.',
      difficulty: 2,
    },
    {
      prompt: 'f(x) = (3x + 1) / 2 fonksiyonunun tersi f⁻¹(x) aşağıdakilerden hangisidir?',
      options: [
        { id: 'a', text: '(2x - 1) / 3' },
        { id: 'b', text: '(2x + 1) / 3' },
        { id: 'c', text: '(3x - 1) / 2' },
        { id: 'd', text: '2 / (3x + 1)' },
      ],
      correctOptionId: 'a',
      explanation: 'y = (3x + 1) / 2 => 2y = 3x + 1 => 2y - 1 = 3x => x = (2y - 1) / 3. Değişkeni x yaparsak: f⁻¹(x) = (2x - 1) / 3.',
      difficulty: 3,
    },
  ],

  'lise-matematik-polinomlar-ve-denklemler': [
    {
      prompt: 'P(x) = 2x³ - 3x² + 4x - 5 polinomunun katsayılar toplamı kaçtır?',
      options: [
        { id: 'a', text: '-2' },
        { id: 'b', text: '2' },
        { id: 'c', text: '-5' },
        { id: 'd', text: '8' },
      ],
      correctOptionId: 'a',
      explanation: 'Bir polinomun katsayılar toplamı P(1) ile bulunur. P(1) = 2(1)³ - 3(1)² + 4(1) - 5 = 2 - 3 + 4 - 5 = -2.',
      difficulty: 2,
    },
  ],

  'lise-matematik-trigonometri': [
    {
      prompt: 'sin²(40°) + cos²(40°) ifadesinin değeri kaçtır?',
      options: [
        { id: 'a', text: '0' },
        { id: 'b', text: '1' },
        { id: 'c', text: '1/2' },
        { id: 'd', text: '√2 / 2' },
      ],
      correctOptionId: 'b',
      explanation: 'Temel trigonometrik özdeşliğe göre tüm x açıları için sin²(x) + cos²(x) = 1\'dir.',
      difficulty: 1,
    },
    {
      prompt: 'tan(45°) + cos(60°) toplamının sonucu kaçtır?',
      options: [
        { id: 'a', text: '1' },
        { id: 'b', text: '3/2' },
        { id: 'c', text: '2' },
        { id: 'd', text: '√3' },
      ],
      correctOptionId: 'b',
      explanation: 'tan(45°) = 1 ve cos(60°) = 1/2 dir. Toplam: 1 + 1/2 = 3/2 (1,5).',
      difficulty: 2,
    },
  ],

  'lise-matematik-logaritma-ve-diziler': [
    {
      prompt: 'log₂(32) ifadesinin eşiti kaçtır?',
      options: [
        { id: 'a', text: '4' },
        { id: 'b', text: '5' },
        { id: 'c', text: '6' },
        { id: 'd', text: '16' },
      ],
      correctOptionId: 'b',
      explanation: '32 = 2⁵ olduğundan log₂(32) = log₂(2⁵) = 5 . log₂(2) = 5 . 1 = 5.',
      difficulty: 2,
    },
  ],

  'lise-matematik-limit-ve-sureklilik': [
    {
      prompt: 'lim (x -> 3) [(x² - 9) / (x - 3)] limitinin değeri kaçtır?',
      options: [
        { id: 'a', text: '0' },
        { id: 'b', text: '3' },
        { id: 'c', text: '6' },
        { id: 'd', text: 'Tanımsız' },
      ],
      correctOptionId: 'c',
      explanation: 'x=3 yazıldığında 0/0 belirsizliği oluşur. Payı çarpanlarına ayıralım: x² - 9 = (x - 3)(x + 3). Sadeleşince lim (x -> 3) (x + 3) = 3 + 3 = 6.',
      difficulty: 3,
    },
  ],

  'lise-matematik-turev-uygulamalari': [
    {
      prompt: 'f(x) = 3x² - 5x + 7 fonksiyonunun türevi f\'(x) nedir?',
      options: [
        { id: 'a', text: '6x - 5' },
        { id: 'b', text: '3x - 5' },
        { id: 'c', text: '6x + 7' },
        { id: 'd', text: '6x² - 5' },
      ],
      correctOptionId: 'a',
      explanation: 'Polinom türev kuralı: d/dx(axⁿ) = a . n . xⁿ⁻¹. Buradan d/dx(3x²) = 6x, d/dx(-5x) = -5, sabitin türevi 0. f\'(x) = 6x - 5.',
      difficulty: 2,
    },
  ],

  'lise-matematik-integral': [
    {
      prompt: '∫ (6x² + 2) dx belirsiz integralinin eşiti hangisidir? (c: integral sabiti)',
      options: [
        { id: 'a', text: '2x³ + 2x + c' },
        { id: 'b', text: '12x + c' },
        { id: 'c', text: '3x³ + 2x + c' },
        { id: 'd', text: '6x³ + 2x + c' },
      ],
      correctOptionId: 'a',
      explanation: '∫ xⁿ dx = (xⁿ⁺¹) / (n + 1) + c kuralından: ∫ 6x² dx = 6(x³/3) = 2x³ ve ∫ 2 dx = 2x. Sonuç: 2x³ + 2x + c.',
      difficulty: 3,
    },
  ],

  'lise-fizik-kuvvet-ve-hareket': [
    {
      prompt: 'Aşağıdakilerden hangisi SI birim sisteminde temel bir büyüklüktür?',
      options: [
        { id: 'a', text: 'Kuvvet' },
        { id: 'b', text: 'Hız' },
        { id: 'c', text: 'Zaman' },
        { id: 'd', text: 'Enerji' },
      ],
      correctOptionId: 'c',
      explanation: 'SI sistemindeki 7 temel büyüklük (KISAMUZ): Kütle, Işık şiddeti, Sıcaklık, Akım şiddeti, Madde miktarı, Uzunluk, Zaman (saniye). Kuvvet, hız ve enerji türetilmiştir.',
      difficulty: 1,
    },
  ],

  'lise-kimya-atom-ve-periyodik-sistem': [
    {
      prompt: 'Aynı elemente ait, proton sayıları aynı fakat nötron sayıları farklı olan atomlara ne ad verilir?',
      options: [
        { id: 'a', text: 'İzoton' },
        { id: 'b', text: 'İzobar' },
        { id: 'c', text: 'İzotop' },
        { id: 'd', text: 'Allotrop' },
      ],
      correctOptionId: 'c',
      explanation: 'Proton sayıları (atom numaraları) aynı, kütle numaraları (nötron sayıları) farklı olan taneciklere izotop atomlar denir.',
      difficulty: 2,
    },
  ],

  'lise-biyoloji-hucre-ve-organeller': [
    {
      prompt: 'Ökaryot bir hücrede hücresel solunum ile ATP (enerji) üretiminin gerçekleştiği organel hangisidir?',
      options: [
        { id: 'a', text: 'Ribozom' },
        { id: 'b', text: 'Mitokondri' },
        { id: 'c', text: 'Golgi aygıtı' },
        { id: 'd', text: 'Lizozom' },
      ],
      correctOptionId: 'b',
      explanation: 'Mitokondri, oksijenli solunum yaparak hücrenin ihtiyaç duyduğu ATP enerjisini üreten enerji santralidir.',
      difficulty: 1,
    },
  ],

  'lise-edebiyat-divan-ve-halk': [
    {
      prompt: 'Dize sonlarındaki sadece bir ses benzerliğine dayanan kafiye (uyak) türü hangisidir?',
      options: [
        { id: 'a', text: 'Yarım kafiye' },
        { id: 'b', text: 'Tam kafiye' },
        { id: 'c', text: 'Zengin kafiye' },
        { id: 'd', text: 'Cinaslı kafiye' },
      ],
      correctOptionId: 'a',
      explanation: 'Tek ses benzerliği: Yarım kafiye; İki ses benzerliği: Tam kafiye; Üç ve daha fazla ses: Zengin kafiye; Yazılışı aynı anlamı farklı: Cinaslı kafiye.',
      difficulty: 1,
    },
  ],

  // ==========================================
  // 4. KPSS (Genel Yetenek & Genel Kültür)
  // ==========================================
  'kpss-genel-yetenek-sozel-mantik': [
    {
      prompt: 'Kalem : Yazmak nasıl bir ilişkiyse, Makas : ? ilişkisi de aynı mantıksal bağıntıya sahiptir.',
      options: [
        { id: 'a', text: 'Kesmek' },
        { id: 'b', text: 'Dikmek' },
        { id: 'c', text: 'Metal' },
        { id: 'd', text: 'Kağıt' },
      ],
      correctOptionId: 'a',
      explanation: 'Kalem, yazmak eylemi için kullanılan bir araçtır. Benzer şekilde makas da kesmek eylemi için kullanılan bir araçtır (Araç - İşlev bağıntısı).',
      difficulty: 1,
    },
    {
      prompt: 'Ahmet, Burak ve Can bir koşu yarışına katılmıştır. Ahmet yarışı Burak\'tan önce, Can\'dan sonra tamamlamıştır. Yarışın sıralaması (1.den 3.ye) nasıldır?',
      options: [
        { id: 'a', text: 'Can - Ahmet - Burak' },
        { id: 'b', text: 'Ahmet - Can - Burak' },
        { id: 'c', text: 'Burak - Ahmet - Can' },
        { id: 'd', text: 'Can - Burak - Ahmet' },
      ],
      correctOptionId: 'a',
      explanation: 'Ahmet Can\'dan sonra geldiğine göre Can 1., Ahmet Burak\'tan önce geldiğine göre Ahmet 2. ve Burak 3. olmuştur.',
      difficulty: 2,
    },
  ],

  'kpss-genel-yetenek-paragraf': [
    {
      prompt: 'Aşağıdaki cümlelerin hangisinde "sıcak" sözcüğü mecaz anlamda kullanılmıştır?',
      options: [
        { id: 'a', text: 'Sıcak çorbayı hemen içti.' },
        { id: 'b', text: 'Bizi kapıda çok sıcak karşıladılar.' },
        { id: 'c', text: 'Bugün hava mevsim normallerinin üstünde sıcaktı.' },
        { id: 'd', text: 'Sıcak su torbasını karnına koydu.' },
      ],
      correctOptionId: 'b',
      explanation: '"Bizi çok sıcak karşıladılar" cümlesinde sıcak kelimesi fiziksel ısıyı değil; samimi, içten ve dostça tavrı anlattığı için mecaz anlamdadır.',
      difficulty: 1,
    },
  ],

  'kpss-genel-yetenek-dil-bilgisi': [
    {
      prompt: '"Sabır" sözcüğüne "-ı" eki getirildiğinde "sabrı" şeklinde yazılması hangi ses olayına örnektir?',
      options: [
        { id: 'a', text: 'Ünlü daralması' },
        { id: 'b', text: 'Ünlü düşmesi' },
        { id: 'c', text: 'Ünsüz yumuşaması' },
        { id: 'd', text: 'Ünsüz benzeşmesi' },
      ],
      correctOptionId: 'b',
      explanation: 'İkinci hecesinde dar ünlü (ı, i, u, ü) bulunan iki heceli sözcükler ünlüyle başlayan ek aldıklarında ikinci hecedeki ünlü düşer (sabır - sabrı). Buna ünlü düşmesi (hece düşmesi) denir.',
      difficulty: 1,
    },
  ],

  'kpss-genel-yetenek-temel-matematik': [
    {
      prompt: '4! - 3! işleminin sonucu kaçtır?',
      options: [
        { id: 'a', text: '1' },
        { id: 'b', text: '6' },
        { id: 'c', text: '18' },
        { id: 'd', text: '20' },
      ],
      correctOptionId: 'c',
      explanation: '4! = 4 x 3 x 2 x 1 = 24. 3! = 3 x 2 x 1 = 6. Buradan 24 - 6 = 18 bulunur.',
      difficulty: 1,
    },
    {
      prompt: 'Hangi sayının %30\'u 45 eder?',
      options: [
        { id: 'a', text: '120' },
        { id: 'b', text: '135' },
        { id: 'c', text: '150' },
        { id: 'd', text: '180' },
      ],
      correctOptionId: 'c',
      explanation: 'Sayı x olsun. x . (30/100) = 45 => 30x = 4500 => x = 150.',
      difficulty: 2,
    },
  ],

  'kpss-genel-kultur-osmanli-tarihi': [
    {
      prompt: 'Osmanlı Devleti\'nde Divan-ı Hümayun\'da alınan kararların İslam dinine ve şeriata uygun olup olmadığına dair fetva veren yetkili kimdir?',
      options: [
        { id: 'a', text: 'Sadrazam' },
        { id: 'b', text: 'Şeyhülislam' },
        { id: 'c', text: 'Kazasker' },
        { id: 'd', text: 'Nişancı' },
      ],
      correctOptionId: 'b',
      explanation: 'Şeyhülislam, ilmiye sınıfının başı olup divan kararlarının dine uygunluğuna ilişkin fetva verme yetkisine sahipti.',
      difficulty: 2,
    },
    {
      prompt: 'Osmanlı Devleti\'nde ilk resmi gazete aşağıdakilerden hangisidir?',
      options: [
        { id: 'a', text: 'Takvim-i Vekayi' },
        { id: 'b', text: 'Ceride-i Havadis' },
        { id: 'c', text: 'Tercüman-ı Ahval' },
        { id: 'd', text: 'Tasvir-i Efkar' },
      ],
      correctOptionId: 'a',
      explanation: 'II. Mahmut döneminde 1831 yılında çıkarılan Takvim-i Vekayi, Osmanlı Devleti\'nin ilk resmi gazetesidir.',
      difficulty: 2,
    },
  ],

  'kpss-genel-kultur-inkilap-tarihi': [
    {
      prompt: '"Milletin bağımsızlığını yine milletin azim ve kararı kurtaracaktır." tarihi kararı ilk kez nerede alınmıştır?',
      options: [
        { id: 'a', text: 'Havza Genelgesi' },
        { id: 'b', text: 'Amasya Genelgesi' },
        { id: 'c', text: 'Erzurum Kongresi' },
        { id: 'd', text: 'Sivas Kongresi' },
      ],
      correctOptionId: 'b',
      explanation: '22 Haziran 1919 tarihli Amasya Genelgesi, Milli Mücadele\'nin amaç, gerekçe ve yöntemini belirten ihtilal beyannamesidir.',
      difficulty: 2,
    },
  ],

  'kpss-genel-kultur-turkiye-fiziki-cografyasi': [
    {
      prompt: 'Türkiye\'nin Karadeniz ve Akdeniz kıyılarında dağların denize paralel uzanmasının doğrudan bir sonucu aşağıdakilerden hangisidir?',
      options: [
        { id: 'a', text: 'Kıyı ile iç kesimler arasında ulaşımın zor olması ve geçitlerle sağlanması' },
        { id: 'b', text: 'Kıta sahanlığının çok geniş olması' },
        { id: 'c', text: 'Koy ve körfez sayısının çok fazla olması' },
        { id: 'd', text: 'Kıyı erozyonunun Ege\'ye göre daha az olması' },
      ],
      correctOptionId: 'a',
      explanation: 'Dağların denize paralel uzandığı boyuna kıyılarda deniz etkisi iç kesimlere sokulamaz ve ulaşım Zigana, Kop, Gülek gibi dağ geçitleriyle sağlanır.',
      difficulty: 2,
    },
  ],

  'kpss-genel-kultur-temel-hukuk': [
    {
      prompt: 'Normlar hiyerarşisinde en üstte yer alan, diğer bütün kanun ve kuralların aykırı olamayacağı temel metin hangisidir?',
      options: [
        { id: 'a', text: 'Kanun' },
        { id: 'b', text: 'Anayasa' },
        { id: 'c', text: 'Cumhurbaşkanlığı Kararnamesi' },
        { id: 'd', text: 'Yönetmelik' },
      ],
      correctOptionId: 'b',
      explanation: 'Normlar hiyerarşisinin (Kelsen piramidi) en tepesinde Anayasa yer alır (Anayasa > Kanun/Milletlerarası Antlaşma > CB Kararnamesi > Yönetmelik).',
      difficulty: 1,
    },
  ],

  'kpss-genel-kultur-anayasa-hukuku': [
    {
      prompt: '1982 Anayasası\'na göre Türkiye Büyük Millet Meclisi (TBMM) kaç milletvekilinden oluşur?',
      options: [
        { id: 'a', text: '450' },
        { id: 'b', text: '500' },
        { id: 'c', text: '550' },
        { id: 'd', text: '600' },
      ],
      correctOptionId: 'd',
      explanation: '2017 Anayasa değişikliği ile TBMM üye tamsayısı 550\'den 600 milletvekiline çıkarılmıştır.',
      difficulty: 1,
    },
  ],
};

module.exports = { SAMPLE_QUESTIONS };
