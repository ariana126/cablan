import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  MatCell,
  MatCellDef,
  MatColumnDef,
  MatHeaderCell,
  MatHeaderCellDef,
  MatHeaderRow,
  MatHeaderRowDef,
  MatRow,
  MatRowDef,
  MatTable,
} from '@angular/material/table';

import { formatJalaliCalendarDate } from '../../core/date/calendar-date';
import { formatJalaliDateTime } from '../../core/date/jalali-datetime';
import { pmDelayLabel } from '../../core/i18n/pm-delay-labels';
import { AppPmOccurrence } from '../../core/maintenance/pm-schedule-gateway';
import { PmStatusBadge } from '../../ui/pm-status-badge/pm-status-badge';

const DISPLAYED_COLUMNS = [
  'equipment',
  'activity',
  'dueDate',
  'status',
  'daysLate',
  'performedBy',
  'performedAt',
];

/** What a cell shows for a value an occurrence does not have yet, as the other report pages do. */
const NONE = '—';

/**
 * «جدول PM»: the schedule's occurrences as one row each, in the API's order (equipment, plan order,
 * due date) and unpaginated — the range bounds how many there are. Drawn even when empty, with the
 * reason under it rather than in a `matNoDataRow`, which Material would give the data-row class.
 */
@Component({
  selector: 'app-pm-schedule-table',
  imports: [
    MatCell,
    MatCellDef,
    MatColumnDef,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatRow,
    MatRowDef,
    MatTable,
    PmStatusBadge,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <table mat-table [dataSource]="occurrences()">
      <ng-container matColumnDef="equipment">
        <th mat-header-cell *matHeaderCellDef>تجهیز</th>
        <td mat-cell *matCellDef="let occurrence">{{ occurrence.equipmentName }}</td>
      </ng-container>

      <ng-container matColumnDef="activity">
        <th mat-header-cell *matHeaderCellDef>فعالیت</th>
        <td mat-cell *matCellDef="let occurrence">{{ occurrence.activityName }}</td>
      </ng-container>

      <ng-container matColumnDef="dueDate">
        <th mat-header-cell *matHeaderCellDef>
          <span class="cell-end">موعد</span>
        </th>
        <td mat-cell *matCellDef="let occurrence">
          <span class="cell-end">{{ jalaliDate(occurrence.dueDate) }}</span>
        </td>
      </ng-container>

      <ng-container matColumnDef="status">
        <th mat-header-cell *matHeaderCellDef>وضعیت</th>
        <td mat-cell *matCellDef="let occurrence">
          <app-pm-status-badge [status]="occurrence.status" />
        </td>
      </ng-container>

      <ng-container matColumnDef="daysLate">
        <th mat-header-cell *matHeaderCellDef>
          <span class="cell-end">مقدار تاخیر</span>
        </th>
        <td mat-cell *matCellDef="let occurrence">
          <span class="cell-end">{{ delay(occurrence.daysLate) }}</span>
        </td>
      </ng-container>

      <ng-container matColumnDef="performedBy">
        <th mat-header-cell *matHeaderCellDef>انجام دهنده</th>
        <td mat-cell *matCellDef="let occurrence">{{ occurrence.performedBy ?? none }}</td>
      </ng-container>

      <ng-container matColumnDef="performedAt">
        <th mat-header-cell *matHeaderCellDef>
          <span class="cell-end">زمان انجام</span>
        </th>
        <td mat-cell *matCellDef="let occurrence">
          <span class="cell-end">{{ performedAt(occurrence) }}</span>
        </td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
      <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
    </table>
    @if (occurrences().length === 0) {
      <p class="no-data">هیچ موعدی در این بازه یافت نشد.</p>
    }
  `,
  styleUrl: './pm-schedule-page.scss',
})
export class PmScheduleTable {
  readonly occurrences = input.required<readonly AppPmOccurrence[]>();

  protected readonly displayedColumns = DISPLAYED_COLUMNS;
  protected readonly none = NONE;

  protected readonly jalaliDate = formatJalaliCalendarDate;

  /** «N روز» for a late occurrence, a hyphen for every other. */
  protected readonly delay = pmDelayLabel;

  /** In the viewer's own time zone, like every other instant the app shows. */
  protected performedAt(occurrence: AppPmOccurrence): string {
    if (occurrence.performedAt === null) {
      return NONE;
    }
    const performed = new Date(occurrence.performedAt);
    return Number.isNaN(performed.getTime()) ? NONE : formatJalaliDateTime(performed);
  }
}
