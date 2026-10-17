import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';

/**
 * The head of every delete confirmation: an error-coloured trash tile, the title («حذف {record}»),
 * and under it — projected — the sentence that names the record and says it cannot be undone.
 *
 * There is no close button. The choice here is cancel or delete, and a third way out would blur it;
 * the dialog's own footer carries «انصراف» and the filled `danger` delete button.
 */
@Component({
  selector: 'app-confirm-head',
  imports: [MatDialogTitle, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="confirm-head">
      <span class="dialog-icon-tile">
        <mat-icon>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M4 7h16M10 11v6M14 11v6" />
            <path d="M6 7l1 13h10l1-13M9 7V4h6v3" />
          </svg>
        </mat-icon>
      </span>
      <div class="stack stack--hair">
        <h2 mat-dialog-title class="confirm-head__title">{{ heading() }}</h2>
        <p class="confirm-head__body"><ng-content /></p>
      </div>
    </div>
  `,
  styleUrl: './confirm-head.scss',
})
export class ConfirmHead {
  readonly heading = input.required<string>();
}
