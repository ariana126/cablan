import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Whether a piece of equipment is in service — «فعال» — or «کنار گذاشته شده», as a pill in its
 * folder's header (issue #92). Icon and word together, never colour alone: in service is the
 * positive tile tone with a check, retired the neutral tone with a bar. A `status` because that is
 * what it is: a fact about the record, not a control.
 *
 * Not `app-status-badge`: that pill's four kinds are audit events (created, edited, deleted), and
 * its glyphs say so.
 *
 * `[announced]="false"` drops the `status` role where the pill is one of many — a table row on
 * `/equipment` — since a page of live regions would announce every row.
 */
@Component({
  selector: 'app-equipment-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="equipment-status"
      [attr.role]="announced() ? 'status' : null"
      [class.equipment-status--retired]="retired()"
    >
      <svg
        class="equipment-status__icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        @if (retired()) {
          <circle cx="12" cy="12" r="9" />
          <path d="M5.6 5.6l12.8 12.8" />
        } @else {
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12l3 3 5-6" />
        }
      </svg>
      {{ label() }}
    </span>
  `,
  styleUrl: './equipment-status.scss',
})
export class EquipmentStatus {
  readonly retired = input.required<boolean>();
  readonly announced = input(true);

  protected readonly label = computed(() => (this.retired() ? 'کنار گذاشته شده' : 'فعال'));
}
