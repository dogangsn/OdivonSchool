import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
import { adminGuard } from './core/guards/admin-guard';

/**
 * NOTE on the admin panel path: 'y0n3t1m-9f3a2' is just an example
 * hard-to-guess slug. Change it before going live, and remember the guard
 * (backed by Firestore rules) is the real security boundary - the odd
 * looking URL only reduces casual discovery, it does not replace auth.
 */
export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/home/home').then(m => m.Home) },

  { path: 'giris', loadComponent: () => import('./features/auth/login/login').then(m => m.Login) },
  { path: 'kayit', loadComponent: () => import('./features/auth/register/register').then(m => m.Register) },
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
    path: 'y0n3t1m-9f3a2',
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

  { path: '**', redirectTo: 'giris' },
];
