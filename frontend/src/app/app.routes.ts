import { Routes } from '@angular/router';

import { authGuard } from './core/identity/auth-guard';

/**
 * Every route is lazy, and every route carries a `title`. The title is not decoration: Angular's
 * default `TitleStrategy` writes it to `document.title`, which is what the shell's live region
 * announces after a navigation.
 */
export const routes: Routes = [
  {
    path: 'login',
    title: 'ورود · کاب‌لن',
    loadComponent: () => import('./features/login/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'users',
    title: 'مدیریت کاربران · کاب‌لن',
    canActivate: [authGuard],
    loadComponent: () => import('./features/users/users-page').then((m) => m.UsersPage),
  },
  {
    path: 'materials',
    title: 'مدیریت مواد اولیه · کاب‌لن',
    canActivate: [authGuard],
    loadComponent: () => import('./features/materials/materials-page').then((m) => m.MaterialsPage),
  },
  {
    path: 'components',
    title: 'مدیریت اجزا · کاب‌لن',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/components/components-page').then((m) => m.ComponentsPage),
  },
  {
    path: 'products',
    title: 'مدیریت محصولات · کاب‌لن',
    canActivate: [authGuard],
    loadComponent: () => import('./features/products/products-page').then((m) => m.ProductsPage),
  },
  {
    path: 'standard-boms',
    title: 'مدیریت آنالیز های استاندارد · کاب‌لن',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/standard-boms/standard-boms-page').then((m) => m.StandardBomsPage),
  },
  {
    path: 'boms',
    title: 'مدیریت آنالیز های روزانه · کاب‌لن',
    canActivate: [authGuard],
    loadComponent: () => import('./features/boms/boms-page').then((m) => m.BomsPage),
  },
  {
    path: 'boms/report',
    title: 'گزارش آنالیز های روزانه · کاب‌لن',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/bom-reports/bom-reports-page').then((m) => m.BomReportsPage),
  },
  {
    path: 'standard-boms/report',
    title: 'گزارش آنالیز های استاندارد · کاب‌لن',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/standard-boms/standard-bom-report/standard-bom-reports-page').then(
        (m) => m.StandardBomReportsPage,
      ),
  },
  {
    path: '**',
    title: 'صفحه پیدا نشد · کاب‌لن',
    loadComponent: () => import('./features/not-found/not-found-page').then((m) => m.NotFoundPage),
  },
];
