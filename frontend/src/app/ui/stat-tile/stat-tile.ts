import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * One counted fact about the range a page is filtered to: a label with its icon, a large tabular
 * value, and a short note saying what was counted. Two to four of them sit in a row at the top of a
 * dashboard or report, each a number the page's own rows can back. It is not a `mat-card` and has no
 * trend, sparkline or colour fill.
 *
 * It is a plain block, not a live region: the label and value read in order, so the figure is
 * announced with what it counts. `value` arrives already formatted (a Persian quantity or a Jalali
 * timestamp); `compactValue` is the smaller form a timestamp takes. The icon is projected into `[tileIcon]`;
 * give it `class="icon--small"` (16px, following the label's colour).
 */
@Component({
  selector: 'app-stat-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stat-tile">
      <div class="stat-tile__label">
        <ng-content select="[tileIcon]" />
        <span>{{ label() }}</span>
      </div>
      <div class="stat-tile__value" [class.stat-tile__value--compact]="compactValue()">
        {{ value() }}
      </div>
      @if (note(); as text) {
        <div class="stat-tile__note">{{ text }}</div>
      }
    </div>
  `,
  styleUrl: './stat-tile.scss',
})
export class StatTile {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly note = input<string>();
  readonly compactValue = input(false);
}
