import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatDialogClose, MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';

/**
 * The head every dialog shares: the title as the dialog's `<h2>` (so Material labels the dialog by
 * it), an optional subtitle under it, and a close button at the end. Escape and the close button
 * both cancel.
 *
 * A delete confirmation turns the close button off: the choice there is cancel or delete, and a
 * third way out would blur it. The footer (`.dialog-footer`) and the confirm-delete icon tile
 * (`.dialog-icon-tile`) are global styles in `styles/_dialog.scss`, because they sit on Material's
 * own `mat-dialog-actions` and in the dialog's own markup.
 */
@Component({
  selector: 'app-dialog-head',
  imports: [MatDialogClose, MatDialogTitle, MatIcon, MatIconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <div class="dialog-head__text stack stack--hair">
        <h2 mat-dialog-title class="dialog-head__title">{{ heading() }}</h2>
        @if (subtitle(); as text) {
          <p class="dialog-head__subtitle">{{ text }}</p>
        }
      </div>
      @if (showClose()) {
        <button matIconButton type="button" mat-dialog-close [aria-label]="closeLabel()">
          <mat-icon>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </mat-icon>
        </button>
      }
    </div>
  `,
  styleUrl: './dialog-head.scss',
})
export class DialogHead {
  readonly heading = input.required<string>();
  readonly subtitle = input<string>();
  readonly showClose = input(true);
  readonly closeLabel = input('بستن');
}
