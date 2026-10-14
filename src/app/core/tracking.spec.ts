import { Assignment, ClassMember, ClassProgress, Submission } from '../models/classroom';
import { GameOutcome } from '../games/game-models';
import { buildTracking, entryFromOutcome, masteryLevel, trackingCsv } from './tracking';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 9, 14, 15, 0).getTime();

function member(uid: string, displayName: string): ClassMember {
  return { uid, displayName, grade: 3, joinCode: 'ABC234', joinedAt: NOW - 30 * DAY };
}

function progress(uid: string, overrides: Partial<ClassProgress> = {}): ClassProgress {
  return {
    uid,
    displayName: uid,
    lastActiveAt: NOW - DAY,
    streakDays: 3,
    activities: 1,
    answered: 0,
    correct: 0,
    topics: {},
    ...overrides,
  };
}

function assignment(id: string, dueAt: number | null): Assignment {
  return { id, classId: 'c', teacherId: 't', kind: 'speed', title: `Ödev ${id}`, subject: 'Matematik', dueAt, createdAt: NOW - 5 * DAY };
}

function submission(uid: string, mistakes: { prompt: string; correctAnswer: string }[] = []): Submission {
  return {
    uid,
    displayName: uid,
    score: 10,
    stars: 2,
    correct: 8,
    total: 10,
    durationMs: 1000,
    bestScore: 10,
    bestStars: 2,
    attempts: 1,
    mistakes: mistakes.map((m) => ({ ...m, given: null })),
    firstCompletedAt: NOW - DAY,
    completedAt: NOW - DAY,
  };
}

describe('tracking', () => {
  it('builds rows, flags and summary', () => {
    const t = buildTracking({
      members: [member('ayse', 'Ayşe'), member('can', 'Can'), member('ece', 'Ece')],
      progress: [
        progress('ayse', {
          displayName: 'Ayşe',
          answered: 20,
          correct: 18,
          topics: { cat_a: { label: 'Toplama', subject: 'Matematik', correct: 18, total: 20, lastAt: NOW } },
        }),
        progress('can', {
          displayName: 'Can',
          lastActiveAt: NOW - 10 * DAY,
          answered: 20,
          correct: 6,
          topics: { cat_a: { label: 'Toplama', subject: 'Matematik', correct: 6, total: 20, lastAt: NOW } },
        }),
        progress('stranger', { answered: 50, correct: 50 }),
      ],
      assignments: [assignment('h1', NOW - DAY), assignment('h2', null)],
      submissions: {
        h1: [submission('ayse', [{ prompt: '7 x 8', correctAnswer: '56' }]), submission('stranger')],
        h2: [submission('ayse'), submission('can', [{ prompt: 'x', correctAnswer: 'y' }])],
      },
      now: NOW,
    });

    expect(t.rows.map((r) => r.name)).toEqual(['Ayşe', 'Can', 'Ece']);
    const [ayse, can, ece] = t.rows;
    expect(ayse.flags).toEqual([]);
    expect(ayse.streak).toBe(3);
    expect(can.flags).toEqual(['inactive', 'low', 'overdue']);
    expect(can.streak).toBe(0);
    expect(ece.flags).toEqual(['never', 'overdue']);
    expect(ece.pending).toBe(1);

    expect(t.summary.students).toBe(3);
    expect(t.summary.active7).toBe(1);
    expect(t.summary.submissionRate).toBe(50); // 3 of 6, stranger ignored
    expect(t.summary.avgSuccess).toBe(60); // 24 / 40
    expect(t.columns).toEqual([
      jasmine.objectContaining({ key: 'cat_a', total: 40, pct: 60, students: 2 }),
    ]);
    expect(t.weakTopics.map((c) => c.key)).toEqual(['cat_a']);
    expect(t.hardest.length).toBe(2);
  });

  it('maps outcomes to topic keys shared with tests', () => {
    const base: GameOutcome = {
      gameType: 'quiz',
      gameKey: 'abc',
      title: 'Bilgi Yarışması · Matematik – Kesirler',
      subject: 'Matematik',
      grade: 3,
      categoryId: 'abc',
      score: 1,
      stars: 1,
      correct: 3,
      total: 5,
      durationMs: 1,
      mistakes: [],
    };
    expect(entryFromOutcome(base)).toEqual({ key: 'cat_abc', label: 'Kesirler', subject: 'Matematik', correct: 3, total: 5 });
    const speed = entryFromOutcome({ ...base, gameType: 'speed', gameKey: 'carpma.3', categoryId: undefined, title: 'Hız Turu · Çarpma' });
    expect(speed.key).toBe('speed_carpma_3');
    expect(speed.label).toBe('Çarpma');
  });

  it('writes a safe semicolon CSV', () => {
    const t = buildTracking({
      members: [member('x', '=HYPERLINK("a";"b")')],
      progress: [],
      assignments: [],
      submissions: {},
      now: NOW,
    });
    const csv = trackingCsv(t);
    expect(csv.startsWith('﻿Öğrenci;')).toBeTrue();
    expect(csv).toContain(`"'=HYPERLINK(""a"";""b"")"`);
  });

  it('grades mastery levels', () => {
    expect(masteryLevel(null)).toBe('none');
    expect(masteryLevel(49)).toBe('low');
    expect(masteryLevel(74)).toBe('mid');
    expect(masteryLevel(75)).toBe('high');
  });
});
