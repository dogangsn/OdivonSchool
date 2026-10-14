import { accusative, dative, locative, numberWords, possessiveAccusative } from './turkish-numbers';

describe('turkish-numbers', () => {
  it('writes numbers in words', () => {
    expect(numberWords(0)).toBe('sıfır');
    expect(numberWords(7)).toBe('yedi');
    expect(numberWords(10)).toBe('on');
    expect(numberWords(12)).toBe('on iki');
    expect(numberWords(25)).toBe('yirmi beş');
    expect(numberWords(40)).toBe('kırk');
    expect(numberWords(59)).toBe('elli dokuz');
    expect(numberWords(100)).toBe('yüz');
    expect(numberWords(340)).toBe('üç yüz kırk');
    expect(() => numberWords(1000)).toThrow();
    expect(() => numberWords(2.5)).toThrow();
  });

  it('accusative (belirtme) for 1-12', () => {
    const expected = ['biri', 'ikiyi', 'üçü', 'dördü', 'beşi', 'altıyı', 'yediyi', 'sekizi', 'dokuzu', 'onu', 'on biri', 'on ikiyi'];
    expect(Array.from({ length: 12 }, (_, i) => accusative(i + 1))).toEqual(expected);
  });

  it('dative (yönelme) for 1-12', () => {
    const expected = ['bire', 'ikiye', 'üçe', 'dörde', 'beşe', 'altıya', 'yediye', 'sekize', 'dokuza', 'ona', 'on bire', 'on ikiye'];
    expect(Array.from({ length: 12 }, (_, i) => dative(i + 1))).toEqual(expected);
  });

  it('locative (bulunma) for fraction denominators', () => {
    const expected = ['birde', 'ikide', 'üçte', 'dörtte', 'beşte', 'altıda', 'yedide', 'sekizde', 'dokuzda', 'onda', 'on birde', 'on ikide'];
    expect(Array.from({ length: 12 }, (_, i) => locative(i + 1))).toEqual(expected);
  });

  it('possessive accusative for fraction numerators', () => {
    const expected = ['birini', 'ikisini', 'üçünü', 'dördünü', 'beşini', 'altısını', 'yedisini', 'sekizini', 'dokuzunu', 'onunu', 'on birini', 'on ikisini'];
    expect(Array.from({ length: 12 }, (_, i) => possessiveAccusative(i + 1))).toEqual(expected);
  });

  it('suffixes larger numbers by their last word', () => {
    expect(accusative(25)).toBe('yirmi beşi');
    expect(dative(14)).toBe('on dörde');
  });

  it('refuses numbers whose last word is not in the tables', () => {
    expect(() => accusative(0)).toThrow();
    expect(() => dative(20)).toThrow();
    expect(() => locative(13.5)).toThrow();
  });
});
