import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { startOfDay, subDays } from 'date-fns';

/** A closed interval of instants, as the date filters express one: `from` inclusive, `to` the moment
 * the range was asked for. */
export interface DateRange {
  readonly from: Date;
  readonly to: Date;
}

interface Preset {
  readonly label: string;
  /** How many days back the range reaches, counting today as the first. `0` is today alone. */
  readonly daysBack: number;
}

const PRESETS: readonly Preset[] = [
  { label: 'امروز', daysBack: 0 },
  { label: '۷ روز گذشته', daysBack: 6 },
  { label: '۳۰ روز گذشته', daysBack: 29 },
];

/**
 * The quick answers to "when?" that the three report filters are actually asked — today, this week,
 * this month — offered as one press instead of four fields to fill in.
 *
 * **Buttons, not chips.** The design system maps "chips" to `mat-chip-set`/`mat-chip-listbox`, and
 * neither fits: Material's own documentation says `<mat-chip>` "is not interactive" and that
 * `mat-chip-set` and `mat-chip` "do not implement any specific accessibility pattern", so a click
 * handler on one is a button with no role, no keyboard behaviour and no accessible name.
 * `mat-chip-listbox` is accessible but models a *selection* that persists, which would go stale the
 * moment someone nudged one of the four date fields by hand and leave a highlighted chip claiming a
 * range that is no longer in force. These are actions, so they are `matButton`s inside a
 * `role="group"` — the same shape `features/boms/boms-page.ts` already uses for its filter toolbar.
 *
 * Each range runs from a **midnight boundary** to the instant it was requested. Starting "۷ روز
 * گذشته" at the current time of day instead would silently exclude everything registered earlier
 * this morning on the oldest day, which is not what a person asking for the last seven days means.
 */
@Component({
  selector: 'app-date-range-presets',
  imports: [MatButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="date-range-presets" role="group" [attr.aria-label]="label()">
      @for (preset of presets; track preset.label) {
        <button matButton="outlined" type="button" (click)="select(preset)">
          {{ preset.label }}
        </button>
      }
    </div>
  `,
  styleUrl: './date-range-presets.scss',
})
export class DateRangePresets {
  /** Names the group for a screen reader. Each page says which range it is presetting, since a page
   * may carry more than one set of dates. */
  readonly label = input.required<string>();

  readonly rangeSelected = output<DateRange>();

  protected readonly presets = PRESETS;

  protected select(preset: Preset): void {
    const now = new Date();
    this.rangeSelected.emit({ from: startOfDay(subDays(now, preset.daysBack)), to: now });
  }
}
