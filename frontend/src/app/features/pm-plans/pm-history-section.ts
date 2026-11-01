import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
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
import {
  AppMaintenanceExecution,
  EquipmentGateway,
} from '../../core/maintenance/equipment-gateway';
import { DataSheet } from '../../ui/data-sheet/data-sheet';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { Icon } from '../../ui/icon/icon';
import { PmStatusBadge } from '../../ui/pm-status-badge/pm-status-badge';
import { PmExecutionDetailsDialog } from './pm-execution-details-dialog';

const COLUMNS = ['activity', 'dueDate', 'performedBy', 'performedAt', 'status', 'details'];

/** What a cell shows for a value that is not there, as the other report pages do. */
const NONE = '—';

/**
 * «سابقه PM» — the history section of an equipment's folder (issue #92): every PM recorded on it,
 * newest first, executions of deactivated items and of a retired equipment included. The notes are too
 * long for a row; each row's «جزئیات» opens the whole record.
 *
 * It reads its own data, keyed on `equipmentId`, so it stands on its own in the folder — the way
 * every later section (failures, repairs, parts, documents) will.
 */
@Component({
  selector: 'app-pm-history-section',
  imports: [
    DataSheet,
    EmptyState,
    ErrorBanner,
    Icon,
    MatButton,
    MatCell,
    MatCellDef,
    MatColumnDef,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatIcon,
    MatRow,
    MatRowDef,
    MatTable,
    PmStatusBadge,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-data-sheet
      heading="سابقه PM"
      [count]="historyResource.hasValue() ? history().length : null"
      [loading]="historyResource.isLoading()"
      loadingLabel="در حال بارگذاری سابقهٔ PM"
    >
      @if (historyResource.status() === 'loading') {
        <!-- The sheet's progress bar says it. -->
      } @else if (historyResource.error()) {
        <app-error-banner
          message="سابقهٔ PM بارگذاری نشد."
          retryLabel="تلاش دوباره"
          (retry)="historyResource.reload()"
        />
      } @else if (history().length === 0) {
        <app-empty-state message="هنوز انجامی برای این تجهیز ثبت نشده است." />
      } @else {
        <table mat-table [dataSource]="history()">
          <ng-container matColumnDef="activity">
            <th mat-header-cell *matHeaderCellDef>فعالیت</th>
            <td mat-cell *matCellDef="let execution">{{ execution.activityName }}</td>
          </ng-container>

          <ng-container matColumnDef="dueDate">
            <th mat-header-cell *matHeaderCellDef>
              <span class="cell-end">موعد</span>
            </th>
            <td mat-cell *matCellDef="let execution">
              <span class="cell-end">{{ jalaliDate(execution.dueDate) }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="performedBy">
            <th mat-header-cell *matHeaderCellDef>انجام دهنده</th>
            <td mat-cell *matCellDef="let execution">{{ execution.performedBy }}</td>
          </ng-container>

          <ng-container matColumnDef="performedAt">
            <th mat-header-cell *matHeaderCellDef>
              <span class="cell-end">زمان انجام</span>
            </th>
            <td mat-cell *matCellDef="let execution">
              <span class="cell-end">{{ performedAt(execution) }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>وضعیت</th>
            <td mat-cell *matCellDef="let execution">
              <app-pm-status-badge [status]="execution.status" />
            </td>
          </ng-container>

          <!-- Named by activity and due date, so each row's button is told apart from the others'. -->
          <ng-container matColumnDef="details">
            <th mat-header-cell *matHeaderCellDef>
              <span class="visually-hidden">عملیات</span>
            </th>
            <td mat-cell *matCellDef="let execution">
              <div class="cell-actions">
                <button
                  matButton
                  class="button--small"
                  type="button"
                  [attr.aria-label]="
                    'جزئیات ' + execution.activityName + ' ' + jalaliDate(execution.dueDate)
                  "
                  (click)="openDetails(execution)"
                >
                  <mat-icon appIcon="details" />
                  جزئیات
                </button>
              </div>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
      }
    </app-data-sheet>
  `,
  styleUrl: './pm-history-section.scss',
})
export class PmHistorySection {
  private readonly gateway = inject(EquipmentGateway);
  private readonly dialog = inject(MatDialog);

  readonly equipmentId = input.required<string>();
  /** For the details dialog's subtitle. */
  readonly equipmentName = input.required<string>();

  protected readonly columns = COLUMNS;
  protected readonly jalaliDate = formatJalaliCalendarDate;

  protected readonly historyResource = rxResource({
    params: () => this.equipmentId(),
    stream: ({ params: id }) => this.gateway.maintenanceHistory(id),
  });

  protected readonly history = computed<AppMaintenanceExecution[]>(() =>
    this.historyResource.hasValue() ? this.historyResource.value() : [],
  );

  /** In the viewer's own time zone, like every other instant the app shows. */
  protected performedAt(execution: AppMaintenanceExecution): string {
    const performed = new Date(execution.performedAt);
    return Number.isNaN(performed.getTime()) ? NONE : formatJalaliDateTime(performed);
  }

  /** The record in full, notes included; read-only, so focus simply returns to the button. */
  protected openDetails(execution: AppMaintenanceExecution): void {
    this.dialog.open(PmExecutionDetailsDialog, {
      data: { equipmentName: this.equipmentName(), execution },
    });
  }
}
