import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { AppBomEditRecord, editHistoryLines } from '../../core/boms/bom-edit-history';

/**
 * A daily BOM's edit details («جزئیات ویرایش», issue #73) as one list, one item per line: each
 * record's heading — who, when and why, rendered by the API and shown as is — then each of its
 * changes, record after record. Headings are set apart by weight and by the change lines' indent;
 * the reading order is the DOM order. Name the list with `labelledBy` (a visible heading's id) or,
 * where nothing visible names it, `label`.
 *
 * Material has no component for a flat, mixed-weight line list (`mat-list` is for interactive or
 * avatar-led rows), so this is a plain `<ul>` styled with tokens only.
 */
@Component({
  selector: 'app-edit-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul
      class="edit-history"
      [attr.aria-labelledby]="labelledBy() ?? null"
      [attr.aria-label]="label() ?? null"
    >
      @for (line of lines(); track $index) {
        <li [class]="'edit-history__' + line.kind">{{ line.text }}</li>
      }
    </ul>
  `,
  styleUrl: './edit-history.scss',
})
export class EditHistory {
  readonly history = input.required<readonly AppBomEditRecord[]>();
  readonly labelledBy = input<string>();
  readonly label = input<string>();

  protected readonly lines = computed(() => editHistoryLines(this.history()));
}
