import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { PersianNumberPipe } from '../persian-number/persian-number-pipe';

const SPOKEN: Readonly<Record<'above' | 'below' | 'equal', string>> = {
  above: 'بیشتر از استاندارد',
  below: 'کمتر از استاندارد',
  equal: 'برابر با استاندارد',
};

/**
 * The deviation of a daily BOM's material weight from its standard, as a direction pill in the
 * dashboard's per-product panel. One pill shape for all three outcomes so the column scans as one:
 * above standard is the positive pair with an up arrow, below standard the error pair with a down
 * arrow, an exact match the neutral pair with an equals sign.
 *
 * Colour is never the only cue: the arrow and the column header carry the meaning for a sighted
 * reader, and each pill ends in visually hidden words for a screen reader. `value` is the absolute
 * deviation the API computes, written as a Persian quantity with tabular figures.
 */
@Component({
  selector: 'app-weight-difference',
  imports: [PersianNumberPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="weight-difference" [class]="'weight-difference weight-difference--' + direction()">
      <svg
        class="weight-difference__icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        @switch (direction()) {
          @case ('above') {
            <path d="M12 19V5M6 11l6-6 6 6" />
          }
          @case ('below') {
            <path d="M12 5v14M6 13l6 6 6-6" />
          }
          @default {
            <path d="M5 9h14M5 15h14" />
          }
        }
      </svg>
      <span class="weight-difference__value">{{ value() | persianNumber }}</span>
      <span class="visually-hidden">{{ spoken() }}</span>
    </span>
  `,
  styleUrl: './weight-difference.scss',
})
export class WeightDifference {
  readonly direction = input.required<'above' | 'below' | 'equal'>();
  readonly value = input.required<number>();

  protected spoken(): string {
    return SPOKEN[this.direction()];
  }
}
