import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { formatJalaliCalendarDate } from '../../core/date/calendar-date';
import { AppPmOccurrence } from '../../core/maintenance/pm-schedule-gateway';
import { PmStatusBadge } from '../../ui/pm-status-badge/pm-status-badge';

/**
 * One PM occurrence on the calendar — a day's cell and a busy day's full list — as a button that
 * opens its details: «اکسترودر 1 · تعویض روغن» over its status pill. The status is told three ways,
 * never by colour alone: the stripe on the chip's start edge, the pill's tone, and the pill's icon
 * and word. Its text (and so its accessible name) is the line and the word, «… با تاخیر».
 *
 * Material has nothing for this: `mat-chip` actions are discouraged in favour of buttons (the design
 * system's own rule), and a `matButton` is a single-line label that would not hold the pill. So it is
 * a plain `<button type="button">` styled from tokens alone.
 *
 * A late occurrence sits on the day it was done, so its chip also says «موعد {due date}» (issue
 * #112) — the two dates stay distinguishable.
 */
@Component({
  selector: 'app-pm-occurrence-chip',
  imports: [PmStatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" [class]="'pm-chip pm-chip--' + modifier()" (click)="choose.emit()">
      <span class="pm-chip__name"
        >{{ occurrence().equipmentName }} · {{ occurrence().activityName }}</span
      >
      <app-pm-status-badge [status]="occurrence().status" />
      @if (occurrence().status === 'late') {
        <span class="pm-chip__due">موعد {{ dueDate() }}</span>
      }
    </button>
  `,
  styleUrl: './pm-occurrence-chip.scss',
})
export class PmOccurrenceChip {
  readonly occurrence = input.required<AppPmOccurrence>();
  readonly choose = output<void>();

  /** The status as a BEM modifier — `on_time` becomes `on-time`. */
  protected readonly modifier = computed(() => this.occurrence().status.replace('_', '-'));

  protected readonly dueDate = computed(() => formatJalaliCalendarDate(this.occurrence().dueDate));
}
