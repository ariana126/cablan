import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { Icon } from '../../ui/icon/icon';

/**
 * The page for an unknown path, also rendered in place for a page the signed-in role may not reach,
 * so the URL never reveals whether a page exists.
 *
 * The template stays inline — that is still the house preference for a small component. Only the
 * *styles* moved out, because stylelint cannot read CSS embedded in a `.ts` file and
 * `@angular-eslint/component-max-inline-declarations` therefore caps `styles` at zero.
 */
@Component({
  selector: 'app-not-found-page',
  imports: [Icon, MatButton, MatIcon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page--narrow stack">
      <span class="tile">
        <mat-icon>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
            <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
            <path d="M4 4l16 16" />
          </svg>
        </mat-icon>
      </span>
      <p class="code">خطای ۴۰۴</p>
      <h1>چیزی در این نشانی نیست.</h1>
      <p class="prose">پیوند را بررسی کنید، یا از صفحهٔ اصلی دوباره شروع کنید.</p>
      <div class="actions">
        <a matButton="filled" routerLink="/"><mat-icon appIcon="home" />رفتن به صفحهٔ اصلی</a>
        <button matButton type="button" (click)="back()"><mat-icon appIcon="back" />بازگشت</button>
      </div>
    </div>
  `,
  styleUrl: './not-found-page.scss',
})
export class NotFoundPage {
  private readonly location = inject(Location);

  protected back(): void {
    this.location.back();
  }
}
