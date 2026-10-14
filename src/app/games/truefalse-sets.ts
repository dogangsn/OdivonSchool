import { shuffled } from './math-generator';

/** One statement of the Doğru mu Yanlış mı? game. */
export interface TrueFalseStatement {
  text: string;
  answer: boolean;
  /** Short teaching note shown after a wrong answer. */
  explanation: string;
}

export interface TrueFalseSet {
  id: string;
  title: string;
  description: string;
  emoji: string;
  subject: string;
  grades: number[];
  /** A game uses STATEMENTS_PER_GAME of them at random. */
  statements: TrueFalseStatement[];
}

export const STATEMENTS_PER_GAME = 10;
/** Time limit for one statement. */
export const STATEMENT_MS = 8_000;
/** A round always has at least this many true and this many false statements (when the set allows). */
export const MIN_EACH_ANSWER = 3;

const d = (text: string, explanation: string): TrueFalseStatement => ({ text, answer: true, explanation });
const y = (text: string, explanation: string): TrueFalseStatement => ({ text, answer: false, explanation });

export const TRUEFALSE_SETS: TrueFalseSet[] = [
  {
    id: 'saglikli-yasam',
    title: 'Sağlıklı Yaşam',
    description: 'Temizlik, beslenme ve sağlık bilgini sına',
    emoji: '🍎',
    subject: 'Hayat Bilgisi',
    grades: [1, 2],
    statements: [
      d('Ellerimizi yemekten önce ve sonra yıkamalıyız.', 'Ellerimizdeki mikroplar yiyeceklere geçebilir. Bu yüzden yemekten önce ve sonra ellerimizi sabunla yıkarız.'),
      y('Dişlerimizi günde bir kez, sadece sabahları fırçalamak yeterlidir.', 'Dişlerimizi günde en az iki kez fırçalamalıyız: sabah kahvaltıdan sonra ve gece yatmadan önce.'),
      d('Sabah kahvaltısı günün en önemli öğünlerinden biridir.', 'Kahvaltı, okulda gün boyu dikkatli ve enerjik olmamızı sağlar.'),
      d('Çok şekerli yiyecekler dişlerimize zarar verebilir.', 'Şeker, dişlerde çürüğe yol açan mikropları besler.'),
      y('Su yerine sürekli gazlı içecek içmek sağlıklıdır.', 'Vücudumuzun en çok ihtiyaç duyduğu içecek sudur. Gazlı içecekler çok şeker içerir.'),
      d('Uyku, büyümemiz ve dinlenmemiz için gereklidir.', 'Vücudumuz uykuda dinlenir ve büyür. Çocuklar her gece yeterince uyumalıdır.'),
      d('Hapşırırken ağzımızı ve burnumuzu mendille ya da dirseğimizin içiyle kapatmalıyız.', 'Böylece mikroplar çevremizdeki insanlara yayılmaz.'),
      y('Meyve ve sebzeleri yıkamadan yiyebiliriz.', 'Meyve ve sebzelerin üzerinde toz ve mikrop olabilir. Yemeden önce onları iyice yıkarız.'),
      d('Spor yapmak ve hareket etmek vücudumuzu güçlendirir.', 'Düzenli hareket kaslarımızı ve kemiklerimizi güçlendirir, kalbimizi sağlıklı tutar.'),
      y('Başkasının diş fırçasını kullanmak doğru bir davranıştır.', 'Diş fırçası kişiye özeldir. Diş fırçası, havlu ve tarak gibi eşyalar başkasıyla paylaşılmaz.'),
      d('Tırnaklarımızı düzenli olarak kesmeliyiz.', 'Uzun tırnakların altında kir ve mikrop birikir.'),
      y('Bir ilacı, doktora sormadan kendi kendimize içebiliriz.', 'İlaçları yalnızca doktorun önerisiyle ve bir büyüğümüzün yardımıyla kullanırız.'),
      d('Dengeli beslenmek için her gün farklı besinler yemeliyiz.', 'Süt, sebze, meyve, tahıl ve et gibi farklı besinler vücudumuzu güçlü tutar.'),
    ],
  },
  {
    id: 'trafik-guvenlik',
    title: 'Trafik ve Güvenlik',
    description: 'Trafikte güvende kalma kurallarını hatırla',
    emoji: '🚦',
    subject: 'Hayat Bilgisi',
    grades: [1, 2, 3],
    statements: [
      y('Yaya ışığı kırmızı yanarken karşıdan karşıya geçeriz.', 'Kırmızı ışık “dur” demektir. Yayalar, yaya ışığı yeşil yanınca geçer.'),
      d('Karşıdan karşıya geçerken yaya geçidini kullanmalıyız.', 'Yaya geçidi, yayaların güvenle geçmesi için yapılmıştır. Sürücüler orada yayalara yol verir.'),
      d('Karşıya geçmeden önce sola, sağa, sonra tekrar sola bakarız.', 'Ülkemizde araçlar yolun sağından gider. Bu yüzden önce bize en yakın şeritten, soldan gelen araçlara bakarız.'),
      y('Arabada emniyet kemerini yalnızca ön koltukta oturanlar takar.', 'Arabadaki herkes, arka koltukta oturanlar da emniyet kemeri takmalıdır.'),
      d('Çocuklar arabada arka koltukta oturmalıdır.', 'Küçük çocuklar için arabadaki en güvenli yer arka koltuktur.'),
      d('Trafik ışığında sarı ışık “dikkat, hazırlan” anlamına gelir.', 'Sarı ışık, ışığın birazdan değişeceğini haber verir.'),
      d('Okul servisinden inmek için aracın tamamen durmasını beklemeliyiz.', 'Araç hareket ederken inmek ya da ayağa kalkmak çok tehlikelidir.'),
      d('Kaldırımı olmayan bir yolda, araçları karşıdan görecek şekilde yolun sol kenarından yürürüz.', 'Böylece bize doğru gelen araçları görebilir ve dikkatli davranabiliriz.'),
      y('Bisiklet sürerken kask takmamıza gerek yoktur.', 'Kask, düştüğümüzde başımızı korur. Bisiklete binerken mutlaka kask takarız.'),
      d('Park etmiş iki aracın arasından aniden yola çıkmak tehlikelidir.', 'Sürücüler araçların arkasındaki çocukları göremez. Karşıya görüşün açık olduğu yerden geçeriz.'),
      y('Topumuz yola kaçarsa hemen peşinden koşmalıyız.', 'Önce durur, yolu kontrol ederiz ve bir büyüğümüzden yardım isteriz.'),
      d('Trafik polisinin işaretlerine uymalıyız.', 'Trafik polisi, trafiğin düzenli ve güvenli akmasını sağlar. Onun işaretleri ışıklardan önce gelir.'),
      y('Yaya ışığı yeşil yanınca etrafa bakmadan koşarak geçebiliriz.', 'Yeşil ışıkta bile geçmeden önce sağa sola bakar, koşmadan yürürüz.'),
    ],
  },
  {
    id: 'mevsimler-doga',
    title: 'Mevsimler ve Zaman',
    description: 'Mevsimler, aylar ve doğadaki değişimler',
    emoji: '🍂',
    subject: 'Hayat Bilgisi',
    grades: [1, 2, 3],
    statements: [
      d('Bir yılda dört mevsim vardır.', 'Mevsimler ilkbahar, yaz, sonbahar ve kıştır.'),
      d('Bir yıl 12 aydan oluşur.', 'Ocaktan başlayıp aralıkta biten 12 ay, bir yılı oluşturur.'),
      y('Kış mevsiminde ağaçların çoğu çiçek açar.', 'Ağaçların çoğu ilkbaharda çiçek açar. Kışın birçok ağaç yapraksız kalır.'),
      d('Sonbaharda bazı ağaçların yaprakları sararır ve dökülür.', 'Havalar soğuyunca bazı ağaçlar yapraklarını döker.'),
      d('Yaz mevsiminde günler, kış mevsimindekinden daha uzundur.', 'Yazın Güneş daha erken doğar ve daha geç batar. Bu yüzden gündüzler uzundur.'),
      y('Bir haftada 5 gün vardır.', 'Bir haftada 7 gün vardır: pazartesi, salı, çarşamba, perşembe, cuma, cumartesi ve pazar.'),
      d('Ocak, kış mevsiminin aylarından biridir.', 'Kış ayları aralık, ocak ve şubattır.'),
      y('Temmuz bir sonbahar ayıdır.', 'Temmuz bir yaz ayıdır. Sonbahar ayları eylül, ekim ve kasımdır.'),
      d('Ayılar kışın bir bölümünü kış uykusunda geçirir.', 'Ayılar kışın yiyecek bulmakta zorlanır. Bu yüzden inlerinde uzun süre uyurlar.'),
      d('Leylekler gibi bazı kuşlar, havalar soğuyunca daha sıcak yerlere göç eder.', 'Göçmen kuşlar sonbaharda sıcak ülkelere gider, ilkbaharda geri döner.'),
      y('Kar yağışı en çok yaz mevsiminde görülür.', 'Kar, havanın çok soğuk olduğu kış mevsiminde yağar.'),
      d('Nisan bir ilkbahar ayıdır.', 'İlkbahar ayları mart, nisan ve mayıstır.'),
      d('Bir gün 24 saattir.', 'Bir gün, gündüz ve geceyle birlikte 24 saattir.'),
    ],
  },
  {
    id: 'vucudumuz',
    title: 'Vücudumuzu Tanıyalım',
    description: 'Organlarımız, iskeletimiz ve duyularımız',
    emoji: '🫀',
    subject: 'Fen Bilimleri',
    grades: [3, 4],
    statements: [
      d('Kalp, kanı bütün vücudumuza pompalar.', 'Kalp, göğüs boşluğumuzda bulunan ve kanı vücuda pompalayan güçlü bir kastır.'),
      y('Akciğerlerimiz yediğimiz besinleri sindirir.', 'Akciğerler solunum organımızdır. Besinleri midemiz ve bağırsaklarımız sindirir.'),
      d('Kemiklerimiz vücudumuza destek olur ve şekil verir.', 'İskeletimiz olmasaydı vücudumuz dik duramazdı.'),
      y('İskeletimiz yalnızca kafatasından oluşur.', 'İskelet; kafatası, omurga, kaburgalar, kol ve bacak kemikleri gibi pek çok kemikten oluşur.'),
      d('Kaslarımız hareket etmemizi sağlar.', 'Kaslar kasılıp gevşeyerek kemiklerimizi hareket ettirir.'),
      y('Kalbimiz yalnızca biz uyurken çalışır.', 'Kalbimiz ömrümüz boyunca, gece gündüz hiç durmadan çalışır.'),
      d('Burnumuz koklama duyu organımızdır.', 'Beş duyu organımız göz, kulak, burun, dil ve deridir.'),
      d('Dilimiz sayesinde tat alırız.', 'Dilimiz tatlı, tuzlu, ekşi ve acı tatları ayırt etmemizi sağlar.'),
      d('Gözlerimizi korumak için Güneş’e doğrudan bakmamalıyız.', 'Güneş’e doğrudan bakmak gözlerimize kalıcı zarar verebilir.'),
      y('Kulağımıza kalem gibi sivri cisimler sokmak zararsızdır.', 'Sivri cisimler kulak zarımızı yaralayabilir. Kulaklarımızı yalnızca dışından temizleriz.'),
      d('Derimiz sıcak ve soğuğu hissetmemizi sağlar.', 'Deri, dokunma duyu organımızdır; sıcaklığı, acıyı ve basıncı hisseder.'),
      d('Kafatası beynimizi korur.', 'Beynimiz çok önemli ve hassas bir organdır. Sert kafatası onu darbelere karşı korur.'),
      y('Çok yüksek sesle müzik dinlemek kulaklarımız için faydalıdır.', 'Çok yüksek ses, işitme duyumuza zarar verebilir.'),
    ],
  },
  {
    id: 'maddeyi-taniyalim',
    title: 'Maddeyi Tanıyalım',
    description: 'Katı, sıvı, gaz ve maddenin özellikleri',
    emoji: '🧊',
    subject: 'Fen Bilimleri',
    grades: [3, 4],
    statements: [
      d('Su, dondurucuda katı hâle geçer.', 'Su soğuyunca donar ve buza dönüşür. Buz, suyun katı hâlidir.'),
      d('Buz ısıtılınca erir ve su olur.', 'Katı bir maddenin ısınarak sıvı hâle geçmesine erime denir.'),
      d('Sıvılar konuldukları kabın şeklini alır.', 'Suyu bardağa koyarsak bardağın, şişeye koyarsak şişenin şeklini alır.'),
      y('Katıların belirli bir şekli yoktur.', 'Katıların belirli bir şekli vardır. Bir taş ya da kalem, kaptan kaba konunca şeklini değiştirmez.'),
      d('Hava da bir maddedir ve yer kaplar.', 'Şişirdiğimiz balonu dolduran havadır. Hava yer kaplar ve bir kütlesi vardır.'),
      d('Gazlar bulundukları ortama yayılır.', 'Parfüm kokusunun bütün odaya yayılması buna bir örnektir.'),
      y('Süt bir gazdır.', 'Süt bir sıvıdır; akar ve konulduğu kabın şeklini alır.'),
      d('Su kaynatılınca su buharına dönüşür.', 'Sıvı bir maddenin ısınarak gaz hâle geçmesine buharlaşma denir.'),
      y('Taş suya atıldığında yüzer.', 'Taş suya atılınca dibe batar. Tahta ve mantar gibi maddeler ise suda yüzer.'),
      d('Pamuk, taştan daha yumuşaktır.', 'Maddeleri sertlik ve yumuşaklıklarına göre karşılaştırabiliriz.'),
      y('Cam esnek bir maddedir; bükülünce kırılmadan eski hâline döner.', 'Cam esnek değildir, kırılgandır. Lastik ve sünger ise esnek maddelerdir.'),
      d('Islak çamaşırların güneşte kuruması buharlaşmaya bir örnektir.', 'Çamaşırdaki su ısınarak buharlaşır ve havaya karışır.'),
      d('Tuz suda çözünür.', 'Tuzu suya karıştırınca gözden kaybolur ama su tuzlu olur. Tuz suda çözünmüştür.'),
    ],
  },
  {
    id: 'dunya-gunes-ay',
    title: 'Dünya, Güneş ve Ay',
    description: 'Gök cisimleri hakkında doğru bilgiyi bul',
    emoji: '🌍',
    subject: 'Fen Bilimleri',
    grades: [3, 4],
    statements: [
      d('Dünya’nın şekli küreye benzer.', 'Dünya tam bir küre değildir ama şekli küreye çok benzer.'),
      d('Güneş bir yıldızdır.', 'Güneş, bize en yakın yıldızdır. Isı ve ışık kaynağıdır.'),
      y('Ay kendi ışığını üretir.', 'Ay bir ışık kaynağı değildir. Güneş’ten aldığı ışığı yansıttığı için parlak görünür.'),
      d('Dünya, Güneş’in etrafında döner.', 'Dünya hem kendi etrafında hem de Güneş’in etrafında döner.'),
      d('Dünya’nın kendi etrafında dönmesiyle gece ve gündüz oluşur.', 'Dünya’nın Güneş’e dönük tarafında gündüz, diğer tarafında gece yaşanır.'),
      d('Ay, Dünya’nın etrafında döner.', 'Ay, Dünya’nın doğal uydusudur ve onun etrafında döner.'),
      y('Dünya’nın yüzeyinin büyük kısmı karalarla kaplıdır.', 'Dünya yüzeyinin büyük kısmı, yaklaşık dörtte üçü sularla kaplıdır.'),
      d('Güneş, Dünya’dan çok daha büyüktür.', 'Güneş o kadar büyüktür ki içine bir milyondan fazla Dünya sığabilir.'),
      d('Ay’ın yüzeyinde kraterler vardır.', 'Ay’ın yüzeyi tozlu ve kayalıktır; üzerinde çukurlar yani kraterler bulunur.'),
      y('Ay’ın şekli gerçekten her gece değişir.', 'Ay’ın şekli değişmez. Biz Ay’ın Güneş’ten ışık alan kısmını her gece farklı görürüz. Buna Ay’ın evreleri denir.'),
      d('Dünya’nın en dış katmanına yer kabuğu denir.', 'Üzerinde yaşadığımız taş ve topraktan oluşan katman yer kabuğudur.'),
      y('Güneş geceleri söner, sabah yeniden yanar.', 'Güneş hiç sönmez. Gece, Dünya’nın o an Güneş’e dönük olmayan tarafında yaşanır.'),
      d('Dünya, Güneş’in etrafındaki bir turunu yaklaşık bir yılda tamamlar.', 'Bu tur yaklaşık 365 gün sürer.'),
    ],
  },
  {
    id: 'harfler-kelimeler',
    title: 'Harfler ve Kelimeler',
    description: 'Alfabe, hece ve noktalama bilgini sına',
    emoji: '🔤',
    subject: 'Türkçe',
    grades: [2, 3, 4],
    statements: [
      d('Türk alfabesinde 29 harf vardır.', 'Alfabemiz 8 sesli ve 21 sessiz harften oluşur.'),
      d('Alfabemizde 8 sesli harf vardır.', 'Sesli harfler a, e, ı, i, o, ö, u, ü harfleridir.'),
      y('“Q” harfi Türk alfabesinde yer alır.', 'Türk alfabesinde q, w ve x harfleri yoktur.'),
      d('Cümleler büyük harfle başlar.', 'Her cümlenin ilk kelimesi büyük harfle başlar.'),
      y('Soru cümlelerinin sonuna nokta konur.', 'Soru cümlelerinin sonuna soru işareti (?) konur.'),
      d('Kişi ve yer adları büyük harfle başlar.', 'Ali, Ankara ve Türkiye gibi özel isimler büyük harfle yazılır.'),
      d('“Siyah” ve “kara” eş anlamlı kelimelerdir.', 'Eş anlamlı kelimeler yazılışları farklı, anlamları aynı olan kelimelerdir.'),
      y('“Uzun” ile “büyük” zıt anlamlı kelimelerdir.', '“Uzun” kelimesinin zıt anlamlısı “kısa”, “büyük” kelimesinin zıt anlamlısı “küçük” kelimesidir.'),
      d('“Kitaplar” kelimesi çokluk bildirir.', '-lar ve -ler ekleri kelimeye çokluk anlamı katar.'),
      y('Alfabede “c” harfi “ç” harfinden sonra gelir.', 'Alfabe a, b, c, ç, d diye devam eder. Yani “c” harfi “ç” harfinden önce gelir.'),
      d('Sevinç ve şaşırma bildiren cümlelerin sonuna ünlem işareti konabilir.', 'Örneğin “Ne güzel bir gün!” cümlesinin sonunda ünlem işareti vardır.'),
      d('“Masa” kelimesi iki heceden oluşur.', 'Ma-sa: iki hecelidir. Her hecede bir sesli harf bulunur.'),
      y('“Kelebek” kelimesi iki heceden oluşur.', 'Ke-le-bek: üç hecelidir. Kelimedeki sesli harfleri sayarak hece sayısını bulabiliriz.'),
    ],
  },
  {
    id: 'sayilar-islemler',
    title: 'Sayılar ve İşlemler',
    description: 'Toplama, çıkarma, şekiller ve ölçüler',
    emoji: '🔢',
    subject: 'Matematik',
    grades: [1, 2],
    statements: [
      d('5 + 3 işleminin sonucu 8 olur.', '5 sayısından başlayıp 3 ileri sayarsak 6, 7, 8 deriz.'),
      y('10 sayısı 9 sayısından küçüktür.', '10 sayısı 9 sayısından büyüktür. Sayarken 9 sayısından sonra 10 gelir.'),
      d('12 − 5 işleminin sonucu 7 olur.', '12 sayısından 5 geri sayarsak 11, 10, 9, 8, 7 deriz.'),
      d('Bir onluk, 10 birlikten oluşur.', '10 tane birliği bir araya getirince 1 onluk elde ederiz.'),
      d('47 sayısında 4 onluk ve 7 birlik vardır.', '47 = 40 + 7. Onlar basamağında 4, birler basamağında 7 vardır.'),
      y('Üçgenin 4 kenarı vardır.', 'Üçgenin 3 kenarı ve 3 köşesi vardır. 4 kenarı olan şekiller kare ve dikdörtgendir.'),
      d('Karenin bütün kenarları eşit uzunluktadır.', 'Karenin 4 kenarı vardır ve hepsi aynı uzunluktadır.'),
      y('6 + 6 işleminin sonucu 13 olur.', '6 + 6 = 12. İki tane 6, 12 eder.'),
      d('Yarım saat 30 dakikadır.', 'Bir saat 60 dakikadır; bunun yarısı 30 dakikadır.'),
      y('Bir saat 100 dakikadır.', 'Bir saat 60 dakikadır.'),
      d('15 sayısından hemen sonra 16 sayısı gelir.', 'Birer ileri sayarken 14, 15, 16 diye devam ederiz.'),
      d('Dairenin köşesi yoktur.', 'Daire yuvarlaktır; kenarı ve köşesi yoktur.'),
      d('1 lira 100 kuruştur.', 'Paralarımızda 100 kuruş, 1 liraya eşittir.'),
      y('9 − 9 işleminin sonucu 1 olur.', 'Bir sayıdan kendisini çıkarırsak sonuç 0 olur: 9 − 9 = 0.'),
    ],
  },
  {
    id: 'carpma-bolme-kesir',
    title: 'Çarpma, Bölme ve Kesirler',
    description: 'Çarpım tablosu, bölme, kesir ve ölçme',
    emoji: '✖️',
    subject: 'Matematik',
    grades: [3, 4],
    statements: [
      d('7 × 8 işleminin sonucu 56 olur.', '7 × 8 = 56. Çarpım tablosunda 7 sayısının 8 katı 56 eder.'),
      d('Bir sayıyı 1 ile çarparsak sonuç yine o sayı olur.', 'Örneğin 9 × 1 = 9 ve 25 × 1 = 25.'),
      y('Bir sayıyı 0 ile çarparsak sonuç o sayının kendisi olur.', 'Herhangi bir sayının 0 ile çarpımı 0 olur. Örneğin 8 × 0 = 0.'),
      d('24 ÷ 6 işleminin sonucu 4 olur.', '6 × 4 = 24 olduğu için 24 ÷ 6 = 4.'),
      y('6 × 9 işleminin sonucu 52 olur.', '6 × 9 = 54. İpucu: 6 × 10 = 60, bundan 6 çıkarınca 54 kalır.'),
      d('Bir bütünü 2 eş parçaya bölünce parçalardan her biri yarımdır.', 'Bir elmayı 2 eş parçaya bölersek her parça elmanın yarısıdır.'),
      d('Çeyrek, bir bütünün 4 eş parçasından biridir.', 'Bir pizzayı 4 eş dilime bölersek her dilim pizzanın çeyreğidir.'),
      y('1/2, 1/4 kesrinden küçüktür.', 'Bir bütün 2 parçaya bölünürse parçalar, 4 parçaya bölündüğündekinden büyük olur. Yani 1/2 daha büyüktür.'),
      d('Çarpma işleminde çarpanların yeri değişirse sonuç değişmez.', '4 × 3 ile 3 × 4 aynı sonucu verir: 12.'),
      d('Bir doğal sayıyı 10 ile çarpınca sayının sağına bir sıfır ekleriz.', 'Örneğin 25 × 10 = 250.'),
      y('35 ÷ 5 işleminin sonucu 6 olur.', '35 ÷ 5 = 7, çünkü 5 × 7 = 35.'),
      d('1 metre 100 santimetredir.', 'Uzunluk ölçerken 100 santimetre, 1 metreye eşittir.'),
      y('1 kilogram 100 gramdır.', '1 kilogram 1000 gramdır.'),
      d('0 ÷ 5 işleminin sonucu 0 olur.', 'Elimizde hiç şeker yokken 5 arkadaşa paylaştırırsak her birine 0 şeker düşer.'),
    ],
  },
];

export function trueFalseSetById(id: string): TrueFalseSet | undefined {
  return TRUEFALSE_SETS.find((s) => s.id === id);
}

/**
 * Statements for one round: random, but with at least MIN_EACH_ANSWER true and
 * false ones (when the set has them) so "always tap Doğru" never wins.
 */
export function statementsForGame(
  set: Pick<TrueFalseSet, 'statements'>,
  rng: () => number = Math.random,
  count = STATEMENTS_PER_GAME
): TrueFalseStatement[] {
  const all = shuffled(rng, set.statements);
  const n = Math.min(count, all.length);
  const picked = all.slice(0, n);
  const rest = all.slice(n);
  for (const want of [true, false]) {
    const target = Math.min(MIN_EACH_ANSWER, all.filter((s) => s.answer === want).length, n);
    while (picked.filter((s) => s.answer === want).length < target) {
      const inIdx = rest.findIndex((s) => s.answer === want);
      // Swap out one of the over-represented kind (from the end, so the order stays random).
      const outIdx = picked.map((s) => s.answer !== want).lastIndexOf(true);
      if (inIdx < 0 || outIdx < 0) break;
      const [incoming] = rest.splice(inIdx, 1);
      rest.push(picked[outIdx]);
      picked[outIdx] = incoming;
    }
  }
  return shuffled(rng, picked);
}

/** Points for a correct answer: 100, up to +50 for speed, up to +50 for a streak. */
export function trueFalsePoints(elapsedMs: number, streakBefore: number, limitMs = STATEMENT_MS): number {
  const speedBonus = Math.round(50 * Math.max(0, Math.min(1, 1 - elapsedMs / limitMs)));
  const streakBonus = Math.min(50, 10 * Math.max(0, streakBefore));
  return 100 + speedBonus + streakBonus;
}

export function answerLabel(answer: boolean): string {
  return answer ? 'Doğru' : 'Yanlış';
}
