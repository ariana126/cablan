import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

import { Icon } from '../icon/icon';

/**
 * The app's error surface: a tinted block with an icon that says what failed. As a form-level error
 * it sits above the fields (field errors stay in `mat-error`); as a failed load it replaces the
 * table or the dialog's content, names what failed in bold, gives the cause under it, and carries
 * «تلاش دوباره» as a text button inside the banner, at its end.
 *
 * `role="alert"`, so it is announced when it appears. One sentence per line, with a full stop.
 */
@Component({
  selector: 'app-error-banner',
  imports: [Icon, MatButton, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="error-banner" role="alert">
      <mat-icon class="error-banner__icon">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5M12 16.5v.01" />
        </svg>
      </mat-icon>
      <div class="error-banner__body">
        <p class="error-banner__message">{{ message() }}</p>
        @if (detail(); as cause) {
          <p class="error-banner__detail">{{ cause }}</p>
        }
      </div>
      @if (retryLabel(); as label) {
        <button
          matButton
          class="button--small error-banner__retry"
          type="button"
          (click)="retry.emit()"
        >
          <mat-icon appIcon="retry" />
          {{ label }}
        </button>
      }
    </div>
  `,
  styleUrl: './error-banner.scss',
})
export class ErrorBanner {
  /** What failed, in bold: «فهرست آنالیز های روزانه بارگذاری نشد.» */
  readonly message = input.required<string>();
  /** The cause, under it, in small type. */
  readonly detail = input<string>();
  /** The retry button's text; no button without it. */
  readonly retryLabel = input<string>();
  readonly retry = output<void>();
}
