import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatProgressBar } from '@angular/material/progress-bar';

import { PersianNumberPipe } from '../persian-number/persian-number-pipe';

let nextSheetId = 0;

/**
 * The one framed container every list lives in: its title and result count, its search and column
 * filters, the active-filter strip, the table, and the paginator. A table, its filters and its
 * paginator never float on the page as separate pieces — they are one thing, so they share one
 * frame (tone `surface-container-lowest`, a 1px `outline-variant` hairline, a medium corner,
 * clipped).
 *
 * It is a region named by its own heading, so a screen reader can jump to it and an automated
 * browser can find it by that name. Content is projected into five slots: `[sheetSearch]` and
 * `[sheetFilters]` in the bar, `[sheetChips]` under it, the table as default content, and
 * `[sheetFooter]` last. The table sits in a body that scrolls sideways, so a wide table scrolls
 * inside the frame rather than stretching the page.
 */
@Component({
  selector: 'app-data-sheet',
  imports: [MatProgressBar, PersianNumberPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="data-sheet" [attr.aria-labelledby]="headingId">
      @if (loading()) {
        <mat-progress-bar
          class="data-sheet__progress"
          mode="indeterminate"
          [attr.aria-label]="loadingLabel()"
        />
      }
      <div class="data-sheet__bar">
        <h2 class="data-sheet__title" [id]="headingId">{{ heading() }}</h2>
        @if (count() !== null) {
          <span class="data-sheet__count" role="status">{{ count() | persianNumber }} نتیجه</span>
        }
        <ng-content select="[sheetSearch]" />
        <div class="data-sheet__filters">
          <ng-content select="[sheetFilters]" />
        </div>
      </div>
      <ng-content select="[sheetChips]" />
      <div class="data-sheet__body">
        <ng-content />
      </div>
      <ng-content select="[sheetFooter]" />
    </section>
  `,
  styleUrl: './data-sheet.scss',
})
export class DataSheet {
  readonly heading = input.required<string>();
  /** The number of results; `null` while it is not known yet, and no count is shown. */
  readonly count = input<number | null>(null);
  readonly loading = input(false);
  /** What is loading, for the progress bar's accessible name. */
  readonly loadingLabel = input('در حال بارگذاری');

  protected readonly headingId = `data-sheet-heading-${nextSheetId++}`;
}
