import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { AppApprovalStatus, approvalStatusLabel } from '../../core/i18n/approval-labels';

/**
 * A daily BOM's review status as an icon-and-word pill (issue #113): «در انتظار تایید» with a clock
 * on the neutral tag pair, «تایید» with a check on the positive pair, «عدم تایید» with a cross on the
 * attention pair. The icon is `aria-hidden` and the words are `approvalStatusLabel`'s, so the
 * element's text is exactly the status a table cell has always read. Not a button, not a chip.
 */
@Component({
  selector: 'app-approval-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="'approval-status approval-status--' + status()">
      <svg
        class="approval-status__icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        @switch (status()) {
          @case ('approved') {
            <path d="M5 12l5 5L20 7" />
          }
          @case ('rejected') {
            <path d="M6 6l12 12M18 6L6 18" />
          }
          @default {
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          }
        }
      </svg>
      {{ label() }}
    </span>
  `,
  styleUrl: './approval-status-badge.scss',
})
export class ApprovalStatusBadge {
  readonly status = input.required<AppApprovalStatus>();
  protected readonly label = computed(() => approvalStatusLabel(this.status()));
}
