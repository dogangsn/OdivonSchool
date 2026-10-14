import {
  isStudentAccountEmail,
  loginIdToEmail,
  makePassword,
  makeUsername,
  parseNameList,
  usernameBase,
} from './student-accounts';

function seq(...values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('student accounts', () => {
  it('folds Turkish letters into a username base', () => {
    expect(usernameBase('Ayşe Nur Yılmaz')).toBe('ayse');
    expect(usernameBase('ÇAĞRI Öztürk')).toBe('cagri');
    expect(usernameBase('İlkay')).toBe('ilkay');
    expect(usernameBase('Ümit')).toBe('umit');
    expect(usernameBase('  ')).toBe('ogrenci');
  });

  it('adds a 4-character suffix without look-alike characters', () => {
    const u = makeUsername('Şule', seq(0, 0.5, 0.99, 0.2));
    expect(u).toMatch(/^sule\.[a-z2-9]{4}$/);
    for (let i = 0; i < 50; i++) {
      expect(makeUsername('x').split('.')[1]).not.toMatch(/[01ilo]/);
    }
  });

  it('makes easy passwords of at least 6 characters', () => {
    for (let i = 0; i < 50; i++) {
      const p = makePassword();
      expect(p.length).toBeGreaterThanOrEqual(6);
      expect(p).toMatch(/^[a-z]+\d{2}$/);
    }
  });

  it('maps usernames to the student domain and keeps real e-mails', () => {
    expect(loginIdToEmail(' Ayse.K7M2 ')).toBe('ayse.k7m2@ogrenci.odivonschool.firebaseapp.com');
    expect(loginIdToEmail('veli@example.com')).toBe('veli@example.com');
    expect(isStudentAccountEmail('ayse.k7m2@ogrenci.odivonschool.firebaseapp.com')).toBeTrue();
    expect(isStudentAccountEmail('veli@example.com')).toBeFalse();
  });

  it('parses a pasted name list', () => {
    expect(parseNameList('Ayşe  Yılmaz\n\nCan Demir\r\nayşe yılmaz\n  Elif ')).toEqual([
      'Ayşe Yılmaz',
      'Can Demir',
      'Elif',
    ]);
  });
});
