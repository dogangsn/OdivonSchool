/**
 * Shared Gemini prompt for generating curriculum-aligned questions.
 * Keep in sync with buildPrompt() in src/app/core/services/ai-generator.ts.
 *
 * Rules come from the MEB "Çoktan Seçmeli Soru Yazım Kılavuzu"
 * (https://tymm.meb.gov.tr/upload/kilavuz/coktan-secmeli-soru-yazim-kilavuzu.pdf).
 */

const LEVEL_LABELS = {
  ilkokul: 'İlkokul',
  ortaokul: 'Ortaokul',
  lise: 'Lise',
  kpss: 'KPSS',
};

function gradeText(category) {
  const g = category.grades || [];
  if (!g.length) return LEVEL_LABELS[category.level] || category.level;
  if (g.length === 1) return `${g[0]}. Sınıf`;
  return `${g[0]}-${g[g.length - 1]}. Sınıflar`;
}

function outcomesText(category) {
  const list = category.outcomes || [];
  if (!list.length) return '';
  return [
    '',
    'ÖĞRENME ÇIKTILARI (MEB Türkiye Yüzyılı Maarif Modeli öğretim programı):',
    ...list.map((o) => `- ${o.code}: ${o.text}`),
    '',
    'Soruları bu öğrenme çıktılarına dengeli dağıt. Her sorunun "outcomeCode" alanına ölçtüğü öğrenme çıktısının kodunu yaz.',
    'Öğrenme çıktılarının ve sınıf düzeyinin dışına çıkma; bir üst sınıfın konusunu sorma.',
  ].join('\n');
}

function difficultyGuide(difficulty) {
  return (
    {
      1: 'Çok Kolay / Temel Kavram',
      2: 'Kolay / Anlama ve Uygulama',
      3: 'Orta / Standart Sınav Seviyesi',
      4: 'Zor / Muhakeme ve Analiz',
      5: 'İleri Düzey / Eleme Sorusu',
    }[difficulty] || 'Karışık Zorluk Derecesi (1 ile 5 arası dengeli)'
  );
}

function buildQuestionPrompt(category, count, difficulty, subTopic) {
  const hasOutcomes = (category.outcomes || []).length > 0;
  return `
Sen MEB öğretim programlarına ve ölçme-değerlendirme ilkelerine hakim, uzman bir soru yazarısın.
Eğitim Kademesi: "${LEVEL_LABELS[category.level] || category.level}"
Sınıf: "${gradeText(category)}"
Ders: "${category.subject}"
Tema / Konu: "${category.topic}"
${category.description ? `Konu Kapsamı: ${category.description}` : ''}
${subTopic ? `Özel Odak / Alt Başlık: "${subTopic}"` : ''}
Hedef Zorluk Düzeyi: ${difficultyGuide(difficulty)} (1-5 arası)
Soru Sayısı: ${count} adet
${outcomesText(category)}

GÖREV:
Bu temaya ait, sınıf düzeyine uygun, yüksek kaliteli, çoktan seçmeli ${count} adet soru hazırla.

MEB SORU YAZIM KURALLARI:
1. Mümkün olduğunca gerçek hayattan, öğrencinin kendini içinde görebileceği bir bağlam kullan. Bağlam süs olmasın; okunmadan soru çözülememeli.
2. Dil, cümle uzunluğu, terimler ve sayılar öğrencinin sınıf düzeyine uygun olsun.
3. Bağlam kültür, cinsiyet, bölge, din, ideoloji ve sosyoekonomik durum açısından tarafsız olsun.
4. Soru kökünde konu anlatımı yapma; kök ölçülen beceriyi açıkça istesin.
5. Olumsuz kök gerekiyorsa tek olumsuzluk kullan ve büyük harfle vurgula (ör. "hangisi DEĞİLDİR?"); çift olumsuzluk kullanma.
6. Öznel, kişiden kişiye değişen cevaplı soru yazma.
7. "Hepsi", "Hiçbiri", "A ve B" gibi seçenekler kullanma.
8. Çeldiriciler öğrencinin tipik kavram yanılgılarından ve işlem hatalarından gelsin, rastgele olmasın.
9. Seçenekler uzunluk, dil yapısı ve karmaşıklık bakımından birbirine benzesin; doğru cevap daha uzun ya da ayrıntılı olmasın.
10. Doğru cevabın harfini sorular arasında dengeli dağıt.
11. Sorular birbirinden bağımsız olsun; biri diğerine ipucu vermesin.
12. Görsel gerektiren soru yazma (sadece metin kullanılabilir).
13. Yazım ve noktalama kurallarına uy, anlatım bozukluğu yapma.

TEKNİK KURALLAR:
- Her soruda TAM OLARAK 4 seçenek olmalı: "a", "b", "c", "d".
- "correctOptionId" mutlak surette "a", "b", "c" veya "d" olmalı.
- "explanation": Öğrenci yanlış yaptığında konuyu öğrenebilsin; doğru cevaba nasıl ulaşıldığını adım adım, samimi ve anlaşılır anlat, yaygın hatayı da belirt.
- Sadece aşağıdaki JSON şemasına uyan bir JSON dizisi döndür; önüne veya arkasına açıklama ekleme.

JSON ŞEMASI:
[
  {
    "prompt": "Soru metni",
    "options": [
      { "id": "a", "text": "A seçeneği" },
      { "id": "b", "text": "B seçeneği" },
      { "id": "c", "text": "C seçeneği" },
      { "id": "d", "text": "D seçeneği" }
    ],
    "correctOptionId": "a",
    "explanation": "Detaylı ve öğretici çözüm açıklaması",
    "difficulty": ${difficulty > 0 ? difficulty : 3}${hasOutcomes ? ',\n    "outcomeCode": "Ölçülen öğrenme çıktısının kodu"' : ''}
  }
]
`
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

module.exports = { buildQuestionPrompt };
