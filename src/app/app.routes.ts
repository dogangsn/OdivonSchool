import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
import { adminGuard } from './core/guards/admin-guard';
import { teacherGuard } from './core/guards/teacher-guard';

/**
 * Admin panel lives at /yonetim. Every route path ships in the JS bundle, so a
 * "secret" slug hides nothing; the Firestore rules are the security boundary
 * and adminGuard shows non-admins the 404 page.
 */
export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/home/home').then(m => m.Home) },

  { path: 'giris', loadComponent: () => import('./features/auth/login/login').then(m => m.Login) },
  { path: 'kayit', loadComponent: () => import('./features/auth/register/register').then(m => m.Register) },
  { path: 'eposta-dogrula', loadComponent: () => import('./features/auth/verify-email/verify-email').then(m => m.VerifyEmail) },
  { path: 'fiyatlandirma', loadComponent: () => import('./features/pricing/pricing').then(m => m.Pricing) },
  { path: 'paketler', redirectTo: 'fiyatlandirma', pathMatch: 'full' },

  // Public Test & Category Routes (Guests can solve up to 5 tests via GuestQuotaService)
  {
    path: 'kategoriler',
    loadComponent: () =>
      import('./features/test-solve/category-select/category-select').then(m => m.CategorySelect),
  },
  {
    path: 'test/:categoryId',
    loadComponent: () => import('./features/test-solve/solve/solve').then(m => m.Solve),
  },
  {
    path: 'test/:categoryId/sonuc',
    loadComponent: () => import('./features/test-solve/result/result').then(m => m.Result),
  },

  // Games (public; results are saved only for signed-in players)
  {
    path: 'oyunlar',
    loadComponent: () => import('./features/games/hub/games-hub').then(m => m.GamesHub),
  },
  {
    path: 'oyun/hiz/:presetId',
    loadComponent: () => import('./features/games/speed-round/speed-round').then(m => m.SpeedRound),
  },
  {
    path: 'oyun/eslestir/:setId',
    loadComponent: () => import('./features/games/memory-match/memory-match').then(m => m.MemoryMatch),
  },
  {
    path: 'oyun/dogru-yanlis/:setId',
    loadComponent: () => import('./features/games/true-false/true-false').then(m => m.TrueFalse),
  },
  {
    path: 'oyun/siniflandir/:setId',
    loadComponent: () => import('./features/games/sort-game/sort-game').then(m => m.SortGame),
  },
  {
    path: 'oyun/saat/:presetId',
    loadComponent: () => import('./features/games/clock/clock-game').then(m => m.ClockGame),
  },
  {
    path: 'oyun/sayi-dogrusu/:presetId',
    loadComponent: () => import('./features/games/number-line/number-line').then(m => m.NumberLine),
  },
  {
    path: 'oyun/kesir/:presetId',
    loadComponent: () => import('./features/games/fraction-pizza/fraction-pizza').then(m => m.FractionPizza),
  },
  {
    path: 'oyun/dikkat-radari/:presetId',
    loadComponent: () => import('./features/games/attention/attention-radar').then(m => m.AttentionRadar),
  },
  {
    path: 'oyun/dinle-uygula/:presetId',
    loadComponent: () => import('./features/games/attention/listen-do').then(m => m.ListenDo),
  },
  // Defter Notları + Akıllı Kütüphane (public; reading progress is saved for signed-in users)
  {
    path: 'defter-notlari',
    loadComponent: () => import('./features/notebook/notebook-list/notebook-list').then(m => m.NotebookList),
  },
  {
    path: 'defter-notlari/notlarim/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./features/notebook/my-note/my-note').then(m => m.MyNotePage),
  },
  {
    path: 'defter-notlari/:slug',
    loadComponent: () => import('./features/notebook/notebook-note/notebook-note').then(m => m.NotebookNote),
  },
  {
    path: 'kutuphane',
    loadComponent: () => import('./features/library/library-list/library-list').then(m => m.LibraryList),
  },
  {
    path: 'kutuphane/:bookId',
    loadComponent: () => import('./features/library/book-reader/book-reader').then(m => m.BookReader),
  },
  // Sınıf Araçları (public, browser-only: akıllı tahta için)
  { path: 'araclar', loadComponent: () => import('./features/tools/hub/tools-hub').then(m => m.ToolsHub) },
  { path: 'araclar/sans-carki', loadComponent: () => import('./features/tools/lucky-wheel/lucky-wheel').then(m => m.LuckyWheel) },
  { path: 'araclar/geri-sayim', loadComponent: () => import('./features/tools/class-timer/class-timer').then(m => m.ClassTimer) },
  { path: 'araclar/kac-ders-kaldi', loadComponent: () => import('./features/tools/lessons-left/lessons-left').then(m => m.LessonsLeft) },
  { path: 'araclar/grup', loadComponent: () => import('./features/tools/group-maker/group-maker').then(m => m.GroupMaker) },
  { path: 'araclar/kelime-avi', loadComponent: () => import('./features/tools/word-search-maker/word-search-maker').then(m => m.WordSearchMaker) },
  { path: 'araclar/goz-jimnastigi', loadComponent: () => import('./features/tools/eye-gym/eye-gym').then(m => m.EyeGym) },
  {
    path: 'okuma-kurdu',
    loadComponent: () => import('./features/bookworm/bookworm-page').then(m => m.BookwormPage),
  },
  {
    path: 'evraklar',
    loadComponent: () => import('./features/documents/annual-plan-page').then(m => m.AnnualPlanPage),
  },
  // Sesli Okuma Koçu (public; results are saved only for signed-in readers)
  {
    path: 'okuma',
    loadComponent: () => import('./features/games/reading/reading-list/reading-list').then(m => m.ReadingList),
  },
  {
    path: 'okuma/gunun-okumasi',
    loadComponent: () => import('./features/games/reading/daily/daily-reading').then(m => m.DailyReading),
  },
  {
    path: 'okuma/:textId',
    loadComponent: () => import('./features/games/reading/reader/reader').then(m => m.Reader),
  },
  {
    path: 'oyun/yarisma/:categoryId',
    loadComponent: () => import('./features/games/quiz/quiz').then(m => m.Quiz),
  },

  {
    path: 'ogretmen',
    canActivate: [teacherGuard],
    loadComponent: () => import('./features/teacher/home/teacher-home').then(m => m.TeacherHome),
  },
  {
    path: 'ogretmen/sinif/:classId',
    canActivate: [teacherGuard],
    loadComponent: () => import('./features/teacher/class-detail/class-detail').then(m => m.ClassDetail),
  },
  {
    path: 'ogretmen/icerik',
    canActivate: [teacherGuard],
    loadComponent: () => import('./features/teacher/content-list/content-list').then(m => m.ContentList),
  },
  {
    path: 'ogretmen/icerik/yeni',
    canActivate: [teacherGuard],
    loadComponent: () => import('./features/teacher/content-editor/content-editor').then(m => m.ContentEditor),
  },
  {
    path: 'ogretmen/icerik/:id',
    canActivate: [teacherGuard],
    loadComponent: () => import('./features/teacher/content-editor/content-editor').then(m => m.ContentEditor),
  },
  {
    path: 'ogretmen/sorular',
    canActivate: [teacherGuard],
    loadComponent: () =>
      import('./features/teacher/question-bank/question-list/question-list').then(m => m.QuestionList),
  },
  {
    // ':id' is 'yeni' for a new question; one route so "kaydet ve yeni" keeps the konu.
    path: 'ogretmen/sorular/:id',
    canActivate: [teacherGuard],
    loadComponent: () =>
      import('./features/teacher/question-bank/question-editor/question-editor').then(m => m.QuestionEditor),
  },
  {
    path: 'ogretmen/sinav/yeni',
    canActivate: [teacherGuard],
    loadComponent: () => import('./features/teacher/exam-builder/exam-builder').then(m => m.ExamBuilder),
  },
  {
    path: 'ogretmen/sinif/:classId/sinav/:assignmentId',
    canActivate: [teacherGuard],
    loadComponent: () => import('./features/teacher/exam-report/exam-report').then(m => m.ExamReport),
  },
  {
    path: 'ogretmen/sinif/:classId/kartlar',
    canActivate: [teacherGuard],
    loadComponent: () =>
      import('./features/teacher/print/login-cards/login-cards').then(m => m.LoginCards),
  },
  {
    path: 'ogretmen/sinif/:classId/rapor',
    canActivate: [teacherGuard],
    loadComponent: () =>
      import('./features/teacher/print/parent-report/parent-report').then(m => m.ParentReport),
  },
  {
    path: 'ogretmen/canli/:classId/:sessionId',
    canActivate: [teacherGuard],
    loadComponent: () => import('./features/live/live-host/live-host').then(m => m.LiveHost),
  },
  {
    path: 'canli/:classId/:sessionId',
    canActivate: [authGuard],
    loadComponent: () => import('./features/live/live-play/live-play').then(m => m.LivePlay),
  },
  {
    path: 'tekrar',
    canActivate: [authGuard],
    loadComponent: () => import('./features/review/smart-review/smart-review').then(m => m.SmartReview),
  },
  {
    path: 'duello/yeni',
    canActivate: [authGuard],
    loadComponent: () => import('./features/duel/duel-create/duel-create').then(m => m.DuelCreate),
  },
  {
    path: 'duello/:classId/:duelId',
    canActivate: [authGuard],
    loadComponent: () => import('./features/duel/duel-room/duel-room').then(m => m.DuelRoom),
  },
  {
    path: 'odev/:classId/:assignmentId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/assignments/assignment-play/assignment-play').then(m => m.AssignmentPlay),
  },

  {
    path: 'panel',
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'anasayfa', pathMatch: 'full' },
      {
        path: 'anasayfa',
        loadComponent: () =>
          import('./features/user-panel/dashboard/dashboard').then(m => m.Dashboard),
      },
      {
        path: 'gecmis',
        loadComponent: () =>
          import('./features/user-panel/test-history/test-history').then(m => m.TestHistory),
      },
      {
        path: 'profil',
        loadComponent: () => import('./features/user-panel/profile/profile').then(m => m.Profile),
      },
      // Aliases for links pointing to /panel/kategoriler and /panel/test/...
      {
        path: 'kategoriler',
        loadComponent: () =>
          import('./features/test-solve/category-select/category-select').then(m => m.CategorySelect),
      },
      {
        path: 'test/:categoryId',
        loadComponent: () => import('./features/test-solve/solve/solve').then(m => m.Solve),
      },
      {
        path: 'test/:categoryId/sonuc',
        loadComponent: () => import('./features/test-solve/result/result').then(m => m.Result),
      },
    ],
  },

  {
    path: 'yonetim',
    canActivate: [adminGuard],
    children: [
      { path: '', redirectTo: 'genel-bakis', pathMatch: 'full' },
      {
        path: 'genel-bakis',
        loadComponent: () =>
          import('./features/admin-panel/dashboard/dashboard').then(m => m.AdminDashboard),
      },
      {
        path: 'aboneler',
        loadComponent: () =>
          import('./features/admin-panel/subscriber-list/subscriber-list').then(m => m.SubscriberList),
      },
      {
        path: 'aboneler/:userId',
        loadComponent: () =>
          import('./features/admin-panel/subscriber-detail/subscriber-detail').then(
            m => m.SubscriberDetail
          ),
      },
      {
        path: 'sorular',
        loadComponent: () =>
          import('./features/admin-panel/question-review/question-review').then(
            m => m.QuestionReview
          ),
      },
    ],
  },

  { path: '**', loadComponent: () => import('./features/not-found/not-found').then(m => m.NotFound) },
];
