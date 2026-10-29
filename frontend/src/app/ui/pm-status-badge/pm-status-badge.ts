import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { PM_STATUS_LABELS, PmOccurrenceStatus } from '../../core/i18n/pm-status-labels';

/**
 * Where a PM occurrence stands — done on time, done late, missed, overdue, due today, not yet due —
 * as a pill: icon and word together, never colour alone. Done on time is the positive tone, done
 * late and due today the attention tone, missed and overdue the error tone, upcoming neutral.
 *
 * Its text is the word alone (the icon is `aria-hidden`), so a table cell holding it reads exactly
 * «عقب افتاده», which is what a screen reader announces and what the cell's text is.
 */
@Component({
  selector: 'app-pm-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="pm-status-badge" [class]="'pm-status-badge pm-status-badge--' + modifier()">
      <svg
        class="pm-status-badge__icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        @switch (status()) {
          @case ('on_time') {
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          }
          @case ('late') {
            <circle cx="12" cy="12" r="8" />
            <path d="M12 8v4l2.5 2.5" />
          }
          @case ('missed') {
            <path d="M6 6l12 12M18 6L6 18" />
          }
          @case ('overdue') {
            <path d="M12 4l9 16H3z" />
            <path d="M12 10v4M12 17v.01" />
          }
          @case ('due') {
            <rect x="4" y="5" width="16" height="15" rx="2" />
            <path d="M4 10h16M9 3v4M15 3v4" />
          }
          @default {
            <path d="M5 12h14M13 6l6 6-6 6" />
          }
        }
      </svg>
      {{ label() }}
    </span>
  `,
  styleUrl: './pm-status-badge.scss',
})
export class PmStatusBadge {
  readonly status = input.required<PmOccurrenceStatus>();

  protected readonly label = computed(() => PM_STATUS_LABELS[this.status()]);

  /** The status as a BEM modifier — `on_time` becomes `on-time`. */
  protected readonly modifier = computed(() => this.status().replace('_', '-'));
}
