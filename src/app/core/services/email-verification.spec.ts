import { EMAIL_VERIFICATION_CUTOFF, needsEmailVerification } from './auth';

function fakeUser(email: string, emailVerified: boolean, createdAt: number): any {
  return { email, emailVerified, metadata: { creationTime: new Date(createdAt).toUTCString() } };
}

describe('needsEmailVerification', () => {
  const after = EMAIL_VERIFICATION_CUTOFF + 60_000;
  const before = EMAIL_VERIFICATION_CUTOFF - 60_000;

  it('requires verification for a new unverified sign-up', () => {
    expect(needsEmailVerification(fakeUser('a@b.com', false, after))).toBeTrue();
  });

  it('lets verified users through', () => {
    expect(needsEmailVerification(fakeUser('a@b.com', true, after))).toBeFalse();
  });

  it('does not lock out accounts created before the cutoff', () => {
    expect(needsEmailVerification(fakeUser('a@b.com', false, before))).toBeFalse();
  });

  it('skips teacher-made student accounts', () => {
    expect(needsEmailVerification(fakeUser('ayse.k7m2@ogrenci.odivonschool.firebaseapp.com', false, after))).toBeFalse();
  });

  it('is false when nobody is signed in', () => {
    expect(needsEmailVerification(null)).toBeFalse();
  });
});
