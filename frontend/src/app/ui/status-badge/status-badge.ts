import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * A small pill that says what happened to a record: created, edited, deleted, or a neutral system
 * event. Icon and word together, never colour alone. It is not a button and not a chip: no hover,
 * no action.
 *
 * The four kinds map to the audit log's event types. A record's *type* («محصول», «جز») is not a
 * status and uses `app-type-tag`, so the two columns never look alike.
 */
@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="status-badge" [class]="'status-badge status-badge--' + kind()">
      <svg
        class="status-badge__icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        @switch (kind()) {
          @case ('create') {
            <path d="M12 5v14M5 12h14" />
          }
          @case ('update') {
            <path d="M4 20l4-1L19 8l-3-3L5 16z" />
          }
          @case ('delete') {
            <path d="M4 7h16M10 11v6M14 11v6" />
            <path d="M6 7l1 13h10l1-13M9 7V4h6v3" />
          }
          @default {
            <path d="M5 9h14M5 15h14" />
          }
        }
      </svg>
      {{ label() }}
    </span>
  `,
  styleUrl: './status-badge.scss',
})
export class StatusBadge {
  readonly kind = input.required<'create' | 'update' | 'delete' | 'neutral'>();
  readonly label = input.required<string>();
}
