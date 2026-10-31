import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

import { ActiveFilterChip } from './active-filter-chips';
import { Icon } from '../icon/icon';

/**
 * The strip under a data sheet's bar that lists the filters currently applied, each removable, and
 * a «پاک کردن همه» to drop them all. It renders nothing at all when no filter is active, so a sheet
 * with no filters shows no empty band.
 *
 * A chip here is a pill of text with a remove button — not a `mat-chip` action, which would make the
 * whole chip a button — so the remove control is a real button with its own name.
 *
 * Each chip is one value of one column (issue #47); `multiValueFilterChips` builds them. A chip never
 * grows wider than the strip: a long value wraps inside it rather than pushing the page sideways.
 */
@Component({
  selector: 'app-active-filters',
  imports: [Icon, MatButton, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (chips().length > 0) {
      <div class="active-filters" role="group" aria-label="فیلترهای فعال">
        @for (chip of chips(); track chip.id) {
          <span class="active-filters__chip">
            <span class="active-filters__text"
              >{{ chip.column }}: <strong>{{ chip.value }}</strong></span
            >
            <button
              type="button"
              class="active-filters__remove"
              [attr.aria-label]="chip.removeLabel"
              (click)="removed.emit(chip)"
            >
              <mat-icon class="active-filters__remove-icon">
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
          </span>
        }
        <button matButton class="button--small" type="button" (click)="clearedAll.emit()">
          <mat-icon appIcon="clear" />
          پاک کردن همه
        </button>
      </div>
    }
  `,
  styleUrl: './active-filters.scss',
})
export class ActiveFilters {
  readonly chips = input.required<readonly ActiveFilterChip[]>();
  /** The chip whose remove button was pressed — its `filterKey` and `filterValue` say what goes. */
  readonly removed = output<ActiveFilterChip>();
  readonly clearedAll = output<void>();
}
