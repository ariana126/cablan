import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatSnackBarLabel } from '@angular/material/snack-bar';

/**
 * The success snackbar: the message with a check mark, in the colour Material reserves for an
 * action on an inverse surface. Failure stays a plain text snackbar with an «باشه» action.
 */
@Component({
  selector: 'app-copied-snack-bar',
  imports: [MatIcon, MatSnackBarLabel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span matSnackBarLabel class="copied-snack-bar">
      <mat-icon class="copied-snack-bar__icon">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </mat-icon>
      شناسه کپی شد.
    </span>
  `,
  styleUrl: './copied-snack-bar.scss',
})
export class CopiedSnackBar {}
