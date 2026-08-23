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
    path: '**',
    title: 'صفحه پیدا نشد · کاب‌لن',
    loadComponent: () => import('./features/not-found/not-found-page').then((m) => m.NotFoundPage),
  },
];
