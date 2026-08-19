import { Routes } from '@angular/router';

/**
 * Every route is lazy, and every route carries a `title`. The title is not decoration: Angular's
 * default `TitleStrategy` writes it to `document.title`, which is what the shell's live region
 * announces after a navigation.
 */
export const routes: Routes = [
  {
    path: '**',
    title: 'Page not found · cablan',
    loadComponent: () => import('./features/not-found/not-found-page').then((m) => m.NotFoundPage),
  },
];
