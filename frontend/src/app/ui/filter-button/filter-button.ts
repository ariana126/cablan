import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

import { formatPersianNumber } from '../../core/i18n/persian-numerals';
import { PersianNumberPipe } from '../persian-number/persian-number-pipe';

/**
 * One column filter's button in a data sheet's bar. Idle, it is a dashed pill with a plus and the
 * column name; once any values are chosen it fills with `secondary-container` and shows how many,
 * plus a chevron. Pressing it is the host's business — it opens the column's filter dialog.
 *
 * Material has no component for this (a chip is not a button, and a toggle button is two states of
 * the same thing), so it is built here, from tokens only.
 *
 * Its accessible name is «فیلتر {label}» while idle — it contains the visible label, so a voice user
 * saying what they see still hits it. Once active it says how many values are chosen, since the badge
 * alone would tell a screen reader nothing. A caller that already has a name the rest of
 * the system finds the control by passes `accessibleName`, and that wins.
 */
@Component({
  selector: 'app-filter-button',
  imports: [MatIcon, PersianNumberPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="filter-button"
      [class.filter-button--active]="active()"
      [attr.aria-label]="ariaLabel()"
      [disabled]="disabled()"
      (click)="pressed.emit()"
    >
      @if (!active()) {
        <mat-icon class="filter-button__icon">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </mat-icon>
      }
      <span>{{ label() }}</span>
      @if (active()) {
        <span class="filter-button__count">{{ selectedCount() | persianNumber }}</span>
        <mat-icon class="filter-button__icon">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </mat-icon>
      }
    </button>
  `,
  styleUrl: './filter-button.scss',
})
export class FilterButton {
  readonly label = input.required<string>();
  /** How many values are chosen; 0 means the filter is idle. */
  readonly selectedCount = input(0);
  readonly accessibleName = input<string>();
  /** Disabled while what the filter opens (its list of values) is still loading. */
  readonly disabled = input(false);
  readonly pressed = output<void>();

  protected readonly active = computed(() => this.selectedCount() > 0);

  protected readonly ariaLabel = computed(() => {
    const override = this.accessibleName();
    if (override !== undefined) {
      return override;
    }
    return this.active()
      ? `فیلتر ${this.label()}، ${formatPersianNumber(this.selectedCount())} مقدار انتخاب شده`
      : `فیلتر ${this.label()}`;
  });
}
