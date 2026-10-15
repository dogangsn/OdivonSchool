import { canPlayGames } from './user';

describe('canPlayGames', () => {
  it('lets guests, teachers and sınıf 1-4 students play', () => {
    expect(canPlayGames(null)).toBeTrue();
    expect(canPlayGames({ role: 'teacher', grade: null, gradeLevel: 'ortaokul' })).toBeTrue();
    expect(canPlayGames({ role: 'student', grade: 4, gradeLevel: 'ilkokul' })).toBeTrue();
    expect(canPlayGames({ role: 'student', grade: null, gradeLevel: 'ilkokul' })).toBeTrue();
  });

  it('keeps older students out', () => {
    expect(canPlayGames({ role: 'student', grade: 5, gradeLevel: 'ortaokul' })).toBeFalse();
    expect(canPlayGames({ role: 'user', grade: 10, gradeLevel: 'lise' })).toBeFalse();
    expect(canPlayGames({ role: 'student', grade: null, gradeLevel: 'kpss' })).toBeFalse();
  });
});
