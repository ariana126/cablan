import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

/**
 * The «نمایش رمز عبور» affordance that sits in a password field's suffix.
 *
 * A password field hides what it is being typed into, which is exactly what makes it easy to get
 * wrong — and there is no second field here to catch a typo against. So the visitor gets to look:
 * the toggle owns nothing but the answer to "is it showing right now", and the field it belongs to
 * reads that back to pick its own `type`. Keeping the state here rather than in each page is what
 * lets a form add the toggle without adding a signal of its own.
 *
 * It never touches the value, only the field's `type`, so the password still lives in exactly one
 * place — the form's model — and is still cleared the moment the request that needs it is sent.
 *
 * `aria-pressed` rather than a label that merely swaps: the button is a toggle, and a screen reader
 * should be able to hear its current state, not just what the next press would do.
 */
@Component({
  selector: 'app-password-visibility-toggle',
  imports: [MatIcon, MatIconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      matIconButton
      type="button"
      [attr.aria-pressed]="visible()"
      [attr.aria-label]="visible() ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'"
      (click)="visible.set(!visible())"
    >
      <!--
        Inline SVGs, not the ligature form of mat-icon — this app loads exactly one font
        (Vazirmatn, self-hosted) and no icon font, so a ligature renders as its own literal text.
        Same reasoning, and the same currentColor stroke, as ui/app-shell's menu icon.
      -->
      <mat-icon>
        @if (visible()) {
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3 3l18 18" />
            <path d="M10.6 5.1A9.9 9.9 0 0 1 12 5c6 0 10 7 10 7a17.6 17.6 0 0 1-3.1 3.9" />
            <path d="M6.6 6.6A17.6 17.6 0 0 0 2 12s4 7 10 7a9.9 9.9 0 0 0 4.2-.9" />
            <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
          </svg>
        } @else {
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        }
      </mat-icon>
    </button>
  `,
})
export class PasswordVisibilityToggle {
  /** Whether the field it belongs to is currently showing its value in the clear. */
  readonly visible = model(false);
}
