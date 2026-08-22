import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { RouterLink } from '@angular/router';

/**
 * The template stays inline — that is still the house preference for a small component. Only the
 * *styles* moved out, because stylelint cannot read CSS embedded in a `.ts` file and
 * `@angular-eslint/component-max-inline-declarations` therefore caps `styles` at zero.
 */
@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink, MatButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack">
      <p class="eyebrow">۴۰۴</p>
      <h1>چیزی در این نشانی نیست.</h1>
      <p class="prose">پیوند را بررسی کنید، یا از صفحهٔ اصلی دوباره شروع کنید.</p>
      <div><a matButton="outlined" routerLink="/">رفتن به صفحهٔ اصلی</a></div>
    </div>
  `,
  styleUrl: './not-found-page.scss',
})
export class NotFoundPage {}
