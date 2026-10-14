import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AssignmentLite,
  DAY,
  HOUR,
  PoolUpdateLite,
  ProgressLite,
  StudentDigestInput,
  buildStudentDigest,
  buildTeacherDigest,
  buildTeacherWeeklyEmail,
  buildWeeklyClassReport,
  chunk,
  defaultAppUrl,
  escapeHtml,
  isDeadTokenError,
  isDeliverableEmail,
  isStudentRole,
  istanbulDayKey,
  istanbulDayStart,
  istanbulWeekKey,
  mapLimit,
  poolUpdatesForUser,
  selectStudentDigest,
  tomorrowRange,
  weakTopicsFrom,
} from './notifyLogic';

// Wednesday 14 Oct 2026, 18:00 in Istanbul (UTC+3).
const NOW = Date.UTC(2026, 9, 14, 15, 0);
const TODAY_START = Date.UTC(2026, 9, 13, 21, 0);

function assignment(p: Partial<AssignmentLite> & { id: string }): AssignmentLite {
  return { classId: 'c1', title: `Ödev ${p.id}`, dueAt: null, createdAt: NOW - 30 * DAY, ...p };
}

function pool(p: Partial<PoolUpdateLite>): PoolUpdateLite {
  return {
    level: 'ilkokul',
    grades: [],
    categoryId: 'cat',
    subject: 'Matematik',
    topic: 'Kesirler',
    count: 5,
    createdAt: NOW - HOUR,
    ...p,
  };
}

function digestInput(over: Partial<StudentDigestInput> = {}): StudentDigestInput {
  return {
    user: { uid: 'u1', role: 'student', gradeLevel: 'ilkokul', grade: 3, classIds: ['c1'] },
    now: NOW,
    since: NOW - DAY,
    poolUpdates: [],
    classes: [{ cls: { id: 'c1', name: '3-A' }, recentAssignments: [], dueSoon: [] }],
    submitted: new Set(),
    ...over,
  };
}

// --- time ------------------------------------------------------------------

test('Istanbul day helpers use UTC+3', () => {
  assert.equal(istanbulDayStart(NOW), TODAY_START);
  assert.equal(istanbulDayKey(NOW), '2026-10-14');
  // 23:30 UTC on the 14th is already the 15th in Istanbul.
  assert.equal(istanbulDayKey(Date.UTC(2026, 9, 14, 23, 30)), '2026-10-15');
  const t = tomorrowRange(NOW);
  assert.equal(t.start, TODAY_START + DAY);
  assert.equal(t.end, TODAY_START + 2 * DAY);
});

test('ISO week keys', () => {
  assert.equal(istanbulWeekKey(NOW), '2026-W42');
  assert.equal(istanbulWeekKey(Date.UTC(2026, 0, 1, 12)), '2026-W01'); // Thu 1 Jan 2026
  assert.equal(istanbulWeekKey(Date.UTC(2027, 0, 1, 12)), '2026-W53'); // Fri 1 Jan 2027
  // Sunday 18 Oct 2026 19:00 Istanbul still belongs to W42.
  assert.equal(istanbulWeekKey(Date.UTC(2026, 9, 18, 16)), '2026-W42');
});

// --- generic ---------------------------------------------------------------

test('chunk and mapLimit', async () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  let inFlight = 0;
  let peak = 0;
  const out = await mapLimit([1, 2, 3, 4, 5, 6], 2, async (n) => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight--;
    return n * 2;
  });
  assert.deepEqual(out, [2, 4, 6, 8, 10, 12]);
  assert.equal(peak, 2);
  assert.deepEqual(await mapLimit([], 3, async () => 1), []);
});

test('misc predicates', () => {
  assert.ok(isStudentRole('student'));
  assert.ok(isStudentRole('user'));
  assert.ok(isStudentRole(undefined));
  assert.ok(!isStudentRole('teacher'));
  assert.ok(isDeadTokenError('messaging/registration-token-not-registered'));
  assert.ok(isDeadTokenError('messaging/invalid-registration-token'));
  assert.ok(!isDeadTokenError('messaging/internal-error'));
  assert.equal(escapeHtml(`<b a="1">&'`), '&lt;b a=&quot;1&quot;&gt;&amp;&#39;');
  assert.equal(defaultAppUrl({ GCLOUD_PROJECT: 'p' }), 'https://p.web.app');
  assert.equal(defaultAppUrl({ APP_URL: 'https://x.tr' }), 'https://x.tr');
});

test('isDeliverableEmail skips username accounts and opted-out users', () => {
  assert.ok(isDeliverableEmail({ email: 'ogretmen@okul.k12.tr' }));
  assert.ok(!isDeliverableEmail({ email: 'ogretmen@okul.k12.tr', notifyEmail: false }));
  assert.ok(!isDeliverableEmail({ email: 'ali.x7k2@ogrenci.odivonschool.firebaseapp.com' }));
  assert.ok(!isDeliverableEmail({ email: 'a@b.com', createdByTeacher: 't1' }));
  assert.ok(!isDeliverableEmail({ email: '' }));
  assert.ok(!isDeliverableEmail({ email: 'not-an-email' }));
  assert.ok(isDeliverableEmail({ email: 'x@y.com', notifyEmail: true }));
});

// --- student digest --------------------------------------------------------

test('poolUpdatesForUser matches level, sınıf and window', () => {
  const updates = [
    pool({ topic: 'A' }),
    pool({ topic: 'B', grades: [3, 4] }),
    pool({ topic: 'C', grades: [1] }),
    pool({ topic: 'D', level: 'ortaokul' }),
    pool({ topic: 'E', createdAt: NOW - 2 * DAY }),
  ];
  const got = poolUpdatesForUser(updates, { gradeLevel: 'ilkokul', grade: 3 }, NOW - DAY).map((u) => u.topic);
  assert.deepEqual(got, ['A', 'B']);
  // No sınıf chosen: every grade of the level, like updatesForUser.
  assert.deepEqual(
    poolUpdatesForUser(updates, { gradeLevel: 'ilkokul', grade: null }, NOW - DAY).map((u) => u.topic),
    ['A', 'B', 'C']
  );
  assert.deepEqual(poolUpdatesForUser(updates, { grade: 3 }, 0), []);
});

test('nothing to say → no push', () => {
  assert.equal(buildStudentDigest(digestInput()), null);
  // Old pool update and an old assignment do not count.
  assert.equal(
    buildStudentDigest(
      digestInput({
        poolUpdates: [pool({ createdAt: NOW - 2 * DAY })],
        classes: [
          {
            cls: { id: 'c1', name: '3-A' },
            recentAssignments: [assignment({ id: 'old', createdAt: NOW - 2 * DAY })],
            dueSoon: [],
          },
        ],
      })
    ),
    null
  );
});

test('due tomorrow, unsubmitted only, links straight to the assignment', () => {
  const due = assignment({ id: 'a1', title: 'Kesirler testi', dueAt: TODAY_START + DAY + 20 * HOUR });
  const done = assignment({ id: 'a2', dueAt: TODAY_START + DAY + 10 * HOUR });
  const later = assignment({ id: 'a3', dueAt: TODAY_START + 3 * DAY });
  const input = digestInput({
    classes: [{ cls: { id: 'c1', name: '3-A' }, recentAssignments: [], dueSoon: [due, done, later] }],
    submitted: new Set(['c1/a2']),
  });
  const items = selectStudentDigest(input);
  assert.deepEqual(items.dueTomorrow.map((d) => d.a.id), ['a1']);
  assert.equal(items.dueToday.length, 0);
  const msg = buildStudentDigest(input)!;
  assert.equal(msg.link, '/odev/c1/a1');
  assert.match(msg.body, /Yarın teslim: “Kesirler testi” \(3-A\)/);
  assert.equal(msg.title, 'Teslim tarihi yaklaşan ödevin var');
});

test('due later tonight is "Bugün teslim"; a due item is not repeated as new', () => {
  const tonight = assignment({ id: 'a1', dueAt: NOW + 3 * HOUR, createdAt: NOW - HOUR });
  const input = digestInput({
    classes: [{ cls: { id: 'c1', name: '3-A' }, recentAssignments: [tonight], dueSoon: [tonight] }],
  });
  const items = selectStudentDigest(input);
  assert.equal(items.dueToday.length, 1);
  assert.equal(items.newAssignments.length, 0);
  assert.match(buildStudentDigest(input)!.body, /Bugün teslim/);
});

test('new assignments + pool questions in one message', () => {
  const input = digestInput({
    user: { uid: 'u1', role: 'student', gradeLevel: 'ilkokul', grade: 3, classIds: ['c1', 'c2'] },
    poolUpdates: [
      pool({ categoryId: 'k1', topic: 'Kesirler', count: 7 }),
      pool({ categoryId: 'k1', topic: 'Kesirler', count: 3 }),
      pool({ categoryId: 'k2', topic: 'Eş anlamlı kelimeler', subject: 'Türkçe', count: 4 }),
      pool({ categoryId: 'k3', topic: 'Canlılar', count: 1 }),
    ],
    classes: [
      {
        cls: { id: 'c1', name: '3-A' },
        recentAssignments: [
          assignment({ id: 'n1', createdAt: NOW - 2 * HOUR, dueAt: NOW + 5 * DAY }),
          assignment({ id: 'n2', createdAt: NOW - 3 * HOUR }),
          assignment({ id: 'gone', createdAt: NOW - 2 * HOUR, dueAt: NOW - HOUR }), // already overdue
        ],
        dueSoon: [],
      },
      // Not a member any more / archived: ignored.
      { cls: { id: 'c3', name: 'X' }, recentAssignments: [assignment({ id: 'z', classId: 'c3', createdAt: NOW })], dueSoon: [] },
      {
        cls: { id: 'c2', name: 'Arşiv', archived: true },
        recentAssignments: [assignment({ id: 'y', classId: 'c2', createdAt: NOW })],
        dueSoon: [],
      },
    ],
  });
  const items = selectStudentDigest(input);
  assert.deepEqual(items.newAssignments.map((n) => n.a.id), ['n1', 'n2']);
  assert.equal(items.newQuestions, 15);
  assert.deepEqual(items.topics[0], { subject: 'Matematik', topic: 'Kesirler', count: 10 });
  const msg = buildStudentDigest(input)!;
  assert.equal(msg.link, '/panel/anasayfa');
  assert.equal(msg.title, 'Bugün senin için yenilikler var');
  const lines = msg.body.split('\n');
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^📝 2 yeni ödev/);
  assert.equal(lines[1], '📚 Havuza 15 yeni soru: Kesirler, Eş anlamlı kelimeler ve 1 konu daha');
});

test('only pool questions → link to the test list', () => {
  const msg = buildStudentDigest(digestInput({ poolUpdates: [pool({ count: 2 })] }))!;
  assert.equal(msg.link, '/panel/kategoriler');
  assert.equal(msg.body, '📚 Havuza 2 yeni soru: Kesirler');
});

// --- teacher digest ----------------------------------------------------------

test('teacher digest', () => {
  assert.equal(buildTeacherDigest([]), null);
  assert.equal(buildTeacherDigest([{ cls: { id: 'c', name: '4-B' }, newMembers: 0, closed: [] }]), null);
  const msg = buildTeacherDigest([
    {
      cls: { id: 'c', name: '4-B' },
      newMembers: 2,
      closed: [{ a: assignment({ id: 'a', title: 'Çarpma' }), submitted: 18, members: 24 }],
    },
  ])!;
  assert.equal(msg.link, '/ogretmen');
  assert.equal(
    msg.body,
    '📋 “Çarpma” (4-B) süresi doldu: 18/24 öğrenci teslim etti\n👋 4-B sınıfına 2 yeni öğrenci katıldı'
  );
});

// --- weekly e-mail -------------------------------------------------------------

function progress(uid: string, p: Partial<ProgressLite>): ProgressLite {
  return { uid, displayName: uid.toUpperCase(), lastActiveAt: NOW - HOUR, answered: 0, correct: 0, topics: {}, ...p };
}

test('weakTopicsFrom ports the tracking rule', () => {
  const list = [
    progress('a', {
      topics: {
        k1: { label: 'Kesirler', subject: 'Matematik', correct: 3, total: 10 },
        k2: { label: 'Okuma', subject: 'Türkçe', correct: 9, total: 10 },
        k3: { label: 'Az', subject: 'Fen', correct: 0, total: 5 },
      },
    }),
    progress('b', {
      topics: {
        k1: { label: 'Kesirler', subject: 'Matematik', correct: 3, total: 10 },
        k3: { label: 'Az', subject: 'Fen', correct: 1, total: 4 },
        k4: { label: 'Saat', subject: 'Matematik', correct: 6, total: 10 },
      },
    }),
    progress('stranger', { topics: { k5: { label: 'X', subject: 'Y', correct: 0, total: 50 } } }),
  ];
  const weak = weakTopicsFrom(list, new Set(['a', 'b']));
  assert.deepEqual(
    weak.map((w) => [w.key, w.pct, w.total]),
    [
      ['k1', 30, 20],
      ['k4', 60, 10],
    ] // k3 is at 11 % but has only 9 answers; k2 is fine; the stranger is not a member
  );
});

test('weekly class report and e-mail', () => {
  const members = [
    { uid: 'a', displayName: 'Ayşe' },
    { uid: 'b', displayName: 'Bora' },
    { uid: 'c', displayName: 'Cem' },
    { uid: 'd', displayName: 'Deniz' },
  ];
  const report = buildWeeklyClassReport({
    cls: { id: 'c1', name: '3-A <Sabah>' },
    members,
    progress: [
      progress('a', {
        displayName: 'Ayşe',
        lastActiveAt: NOW - 2 * DAY,
        answered: 20,
        correct: 10,
        topics: { k1: { label: 'Kesirler', subject: 'Matematik', correct: 4, total: 12 } },
      }),
      progress('b', { displayName: 'Bora', lastActiveAt: NOW - 9 * DAY, answered: 10, correct: 9 }),
      progress('c', { displayName: 'Cem', lastActiveAt: NOW - 20 * DAY }),
      progress('x', { lastActiveAt: NOW }), // left the class
    ],
    pastDue: [
      assignment({ id: 'p1', title: 'Toplama', dueAt: NOW - 2 * DAY }),
      assignment({ id: 'p2', title: 'Hepsi yaptı', dueAt: NOW - 3 * DAY }),
      assignment({ id: 'p3', title: 'Henüz değil', dueAt: NOW + DAY }),
    ],
    submissions: { p1: ['a', 'x'], p2: ['a', 'b', 'c', 'd'] },
    now: NOW,
  });
  assert.equal(report.students, 4);
  assert.equal(report.activeThisWeek, 1);
  assert.deepEqual(report.inactive, [
    { name: 'Deniz', days: null },
    { name: 'Cem', days: 20 },
    { name: 'Bora', days: 9 },
  ]);
  assert.deepEqual(report.overdueAssignments, [{ title: 'Toplama', missing: 3, dueAt: NOW - 2 * DAY }]);
  assert.equal(report.missingSubmissions, 3);
  assert.deepEqual(report.weakTopics.map((w) => w.label), ['Kesirler']);
  assert.equal(report.avgSuccess, 63);

  const empty = buildWeeklyClassReport({
    cls: { id: 'c2', name: 'Boş' },
    members: [],
    progress: [],
    pastDue: [],
    submissions: {},
    now: NOW,
  });
  assert.equal(buildTeacherWeeklyEmail('Öğretmen', [empty], NOW, 'https://x'), null);

  const mail = buildTeacherWeeklyEmail('Elif Hoca', [report, empty], NOW, 'https://odivon.web.app/')!;
  assert.equal(mail.subject, 'Haftalık sınıf özeti (08.10.2026 – 14.10.2026)');
  assert.match(mail.text, /Merhaba Elif Hoca,/);
  assert.match(mail.text, /Bu hafta aktif: 1\/4/);
  assert.match(mail.text, /7\+ gündür etkinlik yok: 3 – Deniz \(hiç başlamadı\), Cem \(20 gündür\), Bora \(9 gündür\)/);
  assert.match(mail.text, /Süresi geçen ödevler: 1 ödev \(3 eksik teslim\)/);
  assert.match(mail.text, /Zayıf konular: Matematik – Kesirler \(%33, 12 cevap\)/);
  assert.match(mail.text, /https:\/\/odivon\.web\.app\/ogretmen/);
  assert.ok(!mail.text.includes('Boş'));
  // Names typed by users are escaped in HTML.
  assert.ok(mail.html.includes('3-A &lt;Sabah&gt;'));
  assert.ok(!mail.html.includes('<Sabah>'));
});
