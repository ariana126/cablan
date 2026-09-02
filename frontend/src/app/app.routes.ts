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
    title: 'ورود · کابلان',
    loadComponent: () => import('./features/login/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'users',
    title: 'مدیریت کاربران · کابلان',
    canActivate: [authGuard],
    loadComponent: () => import('./features/users/users-page').then((m) => m.UsersPage),
  },
  {
    path: 'materials',
    title: 'مدیریت مواد اولیه · کابلان',
    canActivate: [authGuard],
    loadComponent: () => import('./features/materials/materials-page').then((m) => m.MaterialsPage),
  },
  {
    path: 'components',
    title: 'مدیریت اجزا · کابلان',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/components/components-page').then((m) => m.ComponentsPage),
  },
  {
    path: 'products',
    title: 'مدیریت محصولات · کابلان',
    canActivate: [authGuard],
    loadComponent: () => import('./features/products/products-page').then((m) => m.ProductsPage),
  },
  {
    path: 'standard-boms',
    title: 'آنالیز های استاندارد · کابلان',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/standard-boms/standard-boms-page').then((m) => m.StandardBomsPage),
  },
  {
    path: 'boms',
    title: 'آنالیز های روزانه · کابلان',
    canActivate: [authGuard],
    loadComponent: () => import('./features/boms/boms-page').then((m) => m.BomsPage),
  },
  {
    path: 'boms/dashboard',
    title: 'داشبورد بررسی روزانه آنالیز ها · کابلان',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/bom-dashboard/bom-dashboard-page').then((m) => m.BomDashboardPage),
  },
  {
    path: 'audit-log',
    title: 'گزارش رویدادهای سیستم · کابلان',
    canActivate: [authGuard],
    loadComponent: () => import('./features/audit-log/audit-log-page').then((m) => m.AuditLogPage),
  },
  {
    path: '**',
    title: 'صفحه پیدا نشد · کابلان',
    loadComponent: () => import('./features/not-found/not-found-page').then((m) => m.NotFoundPage),
  },
];
