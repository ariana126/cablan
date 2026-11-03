import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
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
import { formatTehranJalaliDateTime } from '../../core/date/jalali-datetime';
import {
  AppEquipmentDetail,
  AppInactivePmPlanItem,
} from '../../core/maintenance/equipment-gateway';
import { groupBySpecialty } from '../../core/maintenance/specialty-groups';
import { DataSheet } from '../../ui/data-sheet/data-sheet';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { PersianNumberPipe } from '../../ui/persian-number/persian-number-pipe';
import { SpecialtyGroup } from '../../ui/specialty-group/specialty-group';

const COLUMNS = ['activity', 'intervalDays', 'firstDueDate', 'deactivatedAt'];

/**
 * «فعالیت‌های غیرفعال» — the plan rows deactivated in an equipment's folder (issue #91), apart from
 * the active plan so their status cannot be mistaken: each with the interval in force when it was
 * deactivated, its first due date and when it was deactivated (Jalali, Tehran time), in the API's
 * order (earliest deactivated first) inside each specialty's own table (issue #108). A deactivated row is final — never reactivated, re-scheduled
 * or executed again — so the table offers nothing to do. The same activity may be in the active plan
 * again as a new row.
 *
 * Always drawn, for active and retired equipment alike, with a note when nothing was deactivated.
 * Like the plan section it reads nothing itself: the folder passes the equipment in.
 */
@Component({
  selector: 'app-pm-inactive-items-section',
  imports: [
    DataSheet,
    EmptyState,
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
    PersianNumberPipe,
    SpecialtyGroup,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-data-sheet
      heading="فعالیت‌های غیرفعال"
      [count]="items().length"
      [loading]="loading()"
      loadingLabel="در حال بارگذاری فعالیت‌های غیرفعال"
    >
      @if (items().length === 0) {
        <app-empty-state message="هیچ فعالیتی در برنامهٔ این تجهیز غیرفعال نشده است." />
      } @else {
        @for (group of groups(); track group.specialty) {
          <app-specialty-group [specialty]="group.specialty">
            <table mat-table [dataSource]="group.items">
              <ng-container matColumnDef="activity">
                <th mat-header-cell *matHeaderCellDef>فعالیت</th>
                <td mat-cell *matCellDef="let item">{{ item.activityName }}</td>
              </ng-container>

              <ng-container matColumnDef="intervalDays">
                <th mat-header-cell *matHeaderCellDef>
                  <span class="cell-end">دوره (روز)</span>
                </th>
                <td mat-cell *matCellDef="let item">
                  <span class="cell-end">{{ item.intervalDays | persianNumber }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="firstDueDate">
                <th mat-header-cell *matHeaderCellDef>
                  <span class="cell-end">اولین موعد</span>
                </th>
                <td mat-cell *matCellDef="let item">
                  <span class="cell-end">{{ jalaliDate(item.firstDueDate) }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="deactivatedAt">
                <th mat-header-cell *matHeaderCellDef>
                  <span class="cell-end">زمان غیرفعال شدن</span>
                </th>
                <td mat-cell *matCellDef="let item">
                  <span class="cell-end">{{ deactivatedAt(item) }}</span>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columns"></tr>
              <tr mat-row *matRowDef="let row; columns: columns"></tr>
            </table>
          </app-specialty-group>
        }
      }
    </app-data-sheet>
  `,
  styleUrl: './pm-inactive-items-section.scss',
})
export class PmInactiveItemsSection {
  /** The equipment whose deactivated rows these are, as the folder read it. */
  readonly equipment = input.required<AppEquipmentDetail>();
  /** While the folder re-reads the equipment after a change. */
  readonly loading = input(false);

  protected readonly columns = COLUMNS;
  protected readonly jalaliDate = formatJalaliCalendarDate;

  protected readonly items = computed<AppInactivePmPlanItem[]>(() => [
    ...this.equipment().inactivePlanItems,
  ]);

  /** «برق», «مکانیک», then any activity without a specialty — the API's order kept inside each. */
  protected readonly groups = computed(() =>
    groupBySpecialty(this.items(), (item) => item.activitySpecialty),
  );

  protected deactivatedAt(item: AppInactivePmPlanItem): string {
    return formatTehranJalaliDateTime(item.deactivatedAt);
  }
}
