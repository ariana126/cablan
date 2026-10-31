import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

import { Icon, IconName } from '../icon/icon';

/**
 * An empty result: a moment to act, not a failure, so it is a `status` and not an `alert`. Centred
 * in the sheet, with a tile and inbox icon, the title, an optional muted sentence about what to do,
 * and the actions — «پاک کردن فیلترها» (outlined) when filters are on, and any further action the
 * page projects in (its primary one, filled).
 */
@Component({
  selector: 'app-empty-state',
  imports: [Icon, MatButton, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty-state" role="status">
      <span class="empty-state__tile">
        <mat-icon>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M4 13l2-8h12l2 8v6H4z" />
            <path d="M4 13h5l1 2h4l1-2h5" />
          </svg>
        </mat-icon>
      </span>
      <p class="empty-state__message">{{ message() }}</p>
      @if (description(); as text) {
        <p class="empty-state__description">{{ text }}</p>
      }
      <div class="empty-state__actions">
        @if (actionLabel(); as label) {
          <button matButton="outlined" type="button" (click)="action.emit()">
            <mat-icon [appIcon]="actionIcon()" />{{ label }}
          </button>
        }
        <ng-content />
      </div>
    </div>
  `,
  styleUrl: './empty-state.scss',
})
export class EmptyState {
  readonly message = input.required<string>();
  readonly description = input<string>();
  readonly actionLabel = input<string>();
  /** The action's leading icon. Every action offered today clears a search or the filters. */
  readonly actionIcon = input<IconName>('clear');
  readonly action = output<void>();
}
