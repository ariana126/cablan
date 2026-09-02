import { Routes } from '@angular/router';

import { guardedRoute, NOT_FOUND_TITLE } from './core/identity/guarded-route';

/**
 * Every route is lazy, and every route carries a `title`. The title is not decoration: Angular's
 * default `TitleStrategy` writes it to `document.title`, which is what the shell's live region
 * announces after a navigation.
 *
 * Every authenticated route goes through `guardedRoute`, which renders the not-found page in place
 * — same URL, same title — for a role that may not reach it. Which roles those are is decided in
 * `core/identity/navigation.ts`, not here, and a path with no row in that table is reachable by
 * nobody. `/login` is the one page outside that scheme, since it is the page you see before you
 * have a role at all.
 */
export const routes: Routes = [
  {
    path: 'login',
    title: 'ورود · کابلان',
    loadComponent: () => import('./features/login/login-page').then((m) => m.LoginPage),
  },
  guardedRoute({
    path: '',
    title: 'صفحهٔ اصلی · کابلان',
    load: () => import('./features/home/home-page').then((m) => m.HomePage),
  }),
  guardedRoute({
    path: 'users',
    title: 'مدیریت کاربران · کابلان',
    load: () => import('./features/users/users-page').then((m) => m.UsersPage),
  }),
  guardedRoute({
    path: 'materials',
    title: 'مدیریت مواد اولیه · کابلان',
    load: () => import('./features/materials/materials-page').then((m) => m.MaterialsPage),
  }),
  guardedRoute({
    path: 'components',
    title: 'مدیریت اجزا · کابلان',
    load: () => import('./features/components/components-page').then((m) => m.ComponentsPage),
  }),
  guardedRoute({
    path: 'products',
    title: 'مدیریت محصولات · کابلان',
    load: () => import('./features/products/products-page').then((m) => m.ProductsPage),
  }),
  guardedRoute({
    path: 'standard-boms',
    title: 'آنالیز های استاندارد · کابلان',
    load: () =>
      import('./features/standard-boms/standard-boms-page').then((m) => m.StandardBomsPage),
  }),
  guardedRoute({
    path: 'boms',
    title: 'آنالیز های روزانه · کابلان',
    load: () => import('./features/boms/boms-page').then((m) => m.BomsPage),
  }),
  guardedRoute({
    path: 'boms/dashboard',
    title: 'داشبورد بررسی روزانه آنالیز ها · کابلان',
    load: () =>
      import('./features/bom-dashboard/bom-dashboard-page').then((m) => m.BomDashboardPage),
  }),
  guardedRoute({
    path: 'audit-log',
    title: 'گزارش رویدادهای سیستم · کابلان',
    load: () => import('./features/audit-log/audit-log-page').then((m) => m.AuditLogPage),
  }),
  {
    path: '**',
    title: NOT_FOUND_TITLE,
    loadComponent: () => import('./features/not-found/not-found-page').then((m) => m.NotFoundPage),
  },
];
