import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

import { Icon } from '../../ui/icon/icon';

let nextCardId = 0;

/**
 * One piece of equipment on the `/pm-plans` board: a real `<button type="button">` that selects it,
 * `aria-pressed` while it is the selected one.
 *
 * **Its accessible name is the equipment's name alone.** The line under it («۲ فعالیت فعال», or
 * «کنار گذاشته شده») is `aria-hidden` and reaches a screen reader as the button's description
 * (`aria-describedby`) instead, so the card is found by exactly the name a visitor knows it by.
 *
 * Material has no selectable card: `mat-card` is a container, not a control, and
 * `mat-button-toggle` lays its toggles out as one segmented row and becomes a radio group when it
 * is single-select. So this is a plain button styled from the design system's tokens — framed like
 * every container, and when pressed filled with `secondary-container`, outlined in `primary` and
 * marked with a check, so the selection is never told by colour alone.
 */
@Component({
  selector: 'app-pm-equipment-card',
  imports: [Icon, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      class="equipment-card"
      type="button"
      [attr.aria-pressed]="selected()"
      [attr.aria-describedby]="detailId"
      (click)="choose.emit()"
    >
      <span class="equipment-card__head">
        <mat-icon class="equipment-card__icon" appIcon="cog" />
        <span class="equipment-card__name">{{ name() }}</span>
        @if (selected()) {
          <mat-icon class="equipment-card__check" appIcon="check-circle" />
        }
      </span>
      <span class="equipment-card__detail" aria-hidden="true" [id]="detailId">{{ detail() }}</span>
    </button>
  `,
  styleUrl: './pm-equipment-card.scss',
})
export class PmEquipmentCard {
  /** The equipment's name — and the button's whole accessible name. */
  readonly name = input.required<string>();
  /** The line under the name, already worded; the button's description. */
  readonly detail = input.required<string>();
  readonly selected = input(false);

  readonly choose = output<void>();

  protected readonly detailId = `pm-equipment-card-detail-${nextCardId++}`;
}
