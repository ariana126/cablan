import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
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
import { AppPmOccurrence, PmScheduleGateway } from '../../core/maintenance/pm-schedule-gateway';
import { DataSheet } from '../../ui/data-sheet/data-sheet';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { PageHeader } from '../../ui/page-header/page-header';
import { PmStatusBadge } from '../../ui/pm-status-badge/pm-status-badge';

const DISPLAYED_COLUMNS = [
  'equipment',
  'activity',
  'dueDate',
  'status',
  'performedBy',
  'performedAt',
];

/** What a cell shows for a value an occurrence does not have yet, as the other report pages do. */
const NONE = '—';

/**
 * `/pm-schedule/overview` — «گزارش PM» under «فنی». Every occurrence of every
 * active plan item so far, through the next one not yet due, with how it stands: done on time, done
 * late, missed, overdue, due today or upcoming — and who did it, and when. Read-only.
 *
 * Like the daily list, the table is drawn as soon as the answer is in, empty or not, and the sheet's
 * progress bar shows until then.
 */
@Component({
  selector: 'app-pm-overview-page',
  imports: [
    DataSheet,
    ErrorBanner,
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
    PageHeader,
    PmStatusBadge,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack">
      <app-page-header
        heading="گزارش PM"
        description="هر موعد برنامهٔ PM تجهیزات تا امروز: بموقع، با تاخیر یا انجام نشده"
      />

      <app-data-sheet
        heading="موعدهای برنامهٔ PM"
        [count]="
          occurrencesResource.isLoading() || occurrencesResource.error()
            ? null
            : occurrences().length
        "
        [loading]="occurrencesResource.isLoading()"
        loadingLabel="در حال بارگذاری گزارش PM"
      >
        @if (occurrencesResource.status() === 'loading') {
          <!-- The sheet's progress bar says it. -->
        } @else if (forbidden()) {
          <app-error-banner message="شما دسترسی لازم برای مشاهده این بخش را ندارید." />
        } @else if (occurrencesResource.error()) {
          <app-error-banner
            message="گزارش PM بارگذاری نشد."
            retryLabel="تلاش دوباره"
            (retry)="occurrencesResource.reload()"
          />
        } @else {
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
          <!-- Under the table, not a matNoDataRow: Material gives that row the mat-mdc-row class too, so
               it would read as one more row of data. -->
          @if (occurrences().length === 0) {
            <p class="no-data">هنوز هیچ موعدی در برنامهٔ تجهیزات نیست.</p>
          }
        }
      </app-data-sheet>
    </div>
  `,
  styleUrl: './pm-schedule-page.scss',
})
export class PmOverviewPage {
  private readonly gateway = inject(PmScheduleGateway);

  protected readonly displayedColumns = DISPLAYED_COLUMNS;
  protected readonly none = NONE;

  protected readonly occurrencesResource = rxResource({
    stream: () => this.gateway.overview(),
    defaultValue: [] as AppPmOccurrence[],
  });

  protected readonly occurrences = computed<AppPmOccurrence[]>(() =>
    this.occurrencesResource.hasValue() ? this.occurrencesResource.value() : [],
  );

  protected readonly forbidden = computed(() => {
    const error = this.occurrencesResource.error();
    return error instanceof HttpErrorResponse && error.status === 403;
  });

  protected readonly jalaliDate = formatJalaliCalendarDate;

  /** In the viewer's own time zone, like every other instant the app shows. */
  protected performedAt(occurrence: AppPmOccurrence): string {
    if (occurrence.performedAt === null) {
      return NONE;
    }
    const performed = new Date(occurrence.performedAt);
    return Number.isNaN(performed.getTime()) ? NONE : formatJalaliDateTime(performed);
  }
}
