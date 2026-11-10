import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
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
import { formatTehranJalaliDateTime } from '../../core/date/jalali-datetime';
import {
  AppEquipmentDetail,
  AppInactivePmPlanItem,
} from '../../core/maintenance/equipment-gateway';
import { groupBySpecialty } from '../../core/maintenance/specialty-groups';
import { DataSheet } from '../../ui/data-sheet/data-sheet';
import { Icon } from '../../ui/icon/icon';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { PersianNumberPipe } from '../../ui/persian-number/persian-number-pipe';
import { SpecialtyGroup } from '../../ui/specialty-group/specialty-group';
import { ConfirmDeletePmExecutionsDialog } from './confirm-delete-pm-executions-dialog';
import { ConfirmDeletePmPlanItemDialog } from './confirm-delete-pm-plan-item-dialog';

const COLUMNS = ['activity', 'intervalDays', 'firstDueDate', 'deactivatedAt'];
const COLUMNS_WITH_ACTIONS = [...COLUMNS, 'actions'];

/**
 * «فعالیت‌های غیرفعال» — the plan rows deactivated in an equipment's folder (issue #91), apart from
 * the active plan so their status cannot be mistaken: each with the interval in force when it was
 * deactivated, its first due date and when it was deactivated (Jalali, Tehran time), in the API's
 * order (earliest deactivated first) inside each specialty's own table (issue #108). A deactivated row is final — never reactivated, re-scheduled
 * or executed again — so the table offers nothing to do, except to the System Admin (issue #110):
 * «حذف همه سوابق» (its executions) and «حذف ردیف» (the row with them), each behind a confirmation. The same activity may be in the active plan
 * again as a new row.
 *
 * Always drawn, for active and retired equipment alike, with a note when nothing was deactivated.
 * Like the plan section it reads nothing itself: the folder passes the equipment in.
 *
 * **Collapsed as it opens** (issue #112): a record, not the working plan, so it stays out of the
 * way. The sheet keeps its heading and its «N نتیجه» count; a «نمایش» / «پنهان کردن» toggle in its
 * bar (`aria-expanded`, `aria-controls`) draws the tables, which are in the DOM only while open —
 * like the dashboard's «فاقد برنامه». Nothing to hide, no toggle: the empty note shows at once.
 */
@Component({
  selector: 'app-pm-inactive-items-section',
  imports: [
    DataSheet,
    EmptyState,
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
      @if (items().length > 0) {
        <button
          sheetActions
          matButton
          class="button--small"
          type="button"
          [attr.aria-expanded]="expanded()"
          [attr.aria-controls]="contentId"
          (click)="expanded.set(!expanded())"
        >
          <mat-icon [appIcon]="expanded() ? 'close' : 'details'" />
          {{ expanded() ? 'پنهان کردن' : 'نمایش' }}
        </button>
      }
      @if (items().length === 0) {
        <app-empty-state message="هیچ فعالیتی در برنامهٔ این تجهیز غیرفعال نشده است." />
      }
      <div [id]="contentId">
        @if (expanded()) {
          <!-- Issue #114: the specialties side by side on a desktop, one box each. -->
          <div class="specialty-boxes" [class.specialty-boxes--roomy]="canDelete()">
            @for (group of groups(); track group.specialty) {
              <app-specialty-group [specialty]="group.specialty" [framed]="true">
                <table mat-table [dataSource]="group.items">
                  <ng-container matColumnDef="activity">
                    <th mat-header-cell *matHeaderCellDef>فعالیت</th>
                    <td
                      mat-cell
                      *matCellDef="let item"
                      class="inactive-activity"
                      [id]="cellId(item, 'activity')"
                    >
                      {{ item.activityName }}
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="intervalDays">
                    <th mat-header-cell *matHeaderCellDef>
                      <span class="cell-end">دوره (روز)</span>
                    </th>
                    <td mat-cell *matCellDef="let item" [id]="cellId(item, 'interval')">
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

                  <!-- The System Admin's deletions (issue #110), named exactly by what they do and told
                   apart by the row's activity and interval. -->
                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef>
                      <span class="visually-hidden">عملیات</span>
                    </th>
                    <td mat-cell *matCellDef="let item">
                      <div class="cell-actions">
                        <button
                          matButton
                          class="button--small"
                          type="button"
                          [attr.aria-describedby]="describedBy(item)"
                          (click)="openDeleteExecutions(item)"
                        >
                          <mat-icon appIcon="history" />
                          حذف همه سوابق
                        </button>
                        <button
                          matButton
                          class="button--small button--danger"
                          type="button"
                          [attr.aria-describedby]="describedBy(item)"
                          (click)="openDeleteItem(item)"
                        >
                          <mat-icon appIcon="delete" />
                          حذف ردیف
                        </button>
                      </div>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="columns()"></tr>
                  <tr mat-row *matRowDef="let row; columns: columns()"></tr>
                </table>
              </app-specialty-group>
            }
          </div>
        }
      </div>
    </app-data-sheet>
  `,
  styleUrl: './pm-inactive-items-section.scss',
})
export class PmInactiveItemsSection {
  /** The equipment whose deactivated rows these are, as the folder read it. */
  readonly equipment = input.required<AppEquipmentDetail>();
  /** While the folder re-reads the equipment after a change. */
  readonly loading = input(false);
  /** The System Admin deletes a row's executions or the row itself (issue #110). */
  readonly canDelete = input(false);

  /** After a deletion — the folder re-reads the equipment and its history. */
  readonly changed = output<void>();

  private readonly dialog = inject(MatDialog);
  private static nextId = 0;
  private readonly idPrefix = `pm-inactive-${PmInactiveItemsSection.nextId++}`;
  protected readonly contentId = `${this.idPrefix}-content`;

  /** Collapsed until asked for (issue #112); kept as it is across the folder's re-reads. */
  protected readonly expanded = signal(false);

  protected readonly columns = computed(() => (this.canDelete() ? COLUMNS_WITH_ACTIONS : COLUMNS));
  protected readonly jalaliDate = formatJalaliCalendarDate;

  protected readonly items = computed<AppInactivePmPlanItem[]>(() => [
    ...this.equipment().inactivePlanItems,
  ]);

  /** «برق», «مکانیک», then any activity without a specialty — the API's order kept inside each. */
  protected readonly groups = computed(() =>
    groupBySpecialty(this.items(), (item) => item.activitySpecialty),
  );

  protected cellId(item: AppInactivePmPlanItem, column: 'activity' | 'interval'): string {
    return `${this.idPrefix}-${item.id}-${column}`;
  }

  protected describedBy(item: AppInactivePmPlanItem): string {
    return `${this.cellId(item, 'activity')} ${this.cellId(item, 'interval')}`;
  }

  protected openDeleteExecutions(item: AppInactivePmPlanItem): void {
    this.reportChange(
      this.dialog.open(ConfirmDeletePmExecutionsDialog, {
        data: { equipmentId: this.equipment().id, item },
      }),
    );
  }

  protected openDeleteItem(item: AppInactivePmPlanItem): void {
    this.reportChange(
      this.dialog.open(ConfirmDeletePmPlanItemDialog, {
        data: { equipmentId: this.equipment().id, item },
      }),
    );
  }

  private reportChange(ref: MatDialogRef<unknown, boolean | undefined>): void {
    ref.afterClosed().subscribe((changed) => {
      if (changed === true) {
        this.changed.emit();
      }
    });
  }

  protected deactivatedAt(item: AppInactivePmPlanItem): string {
    return formatTehranJalaliDateTime(item.deactivatedAt);
  }
}
