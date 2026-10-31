import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { form } from '@angular/forms/signals';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuContent, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
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
  AppEquipment,
  AppEquipmentDetail,
  AppMaintenanceExecution,
  AppPmPlanItem,
  EquipmentGateway,
} from '../../core/maintenance/equipment-gateway';
import { DataSheet } from '../../ui/data-sheet/data-sheet';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { PageHeader } from '../../ui/page-header/page-header';
import { PersianNumberPipe } from '../../ui/persian-number/persian-number-pipe';
import { PmStatusBadge } from '../../ui/pm-status-badge/pm-status-badge';
import {
  SearchableSelect,
  SearchableSelectOption,
} from '../../ui/searchable-select/searchable-select';
import { AddPmPlanItemDialog } from './add-pm-plan-item-dialog';
import { ChangePmIntervalDialog } from './change-pm-interval-dialog';
import { ConfirmRemovePmPlanItemDialog } from './confirm-remove-pm-plan-item-dialog';
import { PmExecutionDetailsDialog } from './pm-execution-details-dialog';
import { Icon } from '../../ui/icon/icon';

const PLAN_COLUMNS = ['activity', 'intervalDays', 'firstDueDate', 'nextDueDate', 'actions'];
const HISTORY_COLUMNS = ['activity', 'dueDate', 'performedBy', 'performedAt', 'status', 'details'];

/** What a cell shows for a value that is not there, as the other report pages do. */
const NONE = '—';

/**
 * `/pm-plans` — «پرونده فنی تجهیزات» under «فنی». One piece of equipment at a time: pick it, then
 * add activities to its plan with the «برنامه PM» sheet's «افزودن فعالیت» (interval in days, Jalali
 * first due date), change an item's interval or remove it from the row's menu, and read what has
 * been done on it so far in «سابقه PM».
 *
 * Retired equipment is offered too, marked «(کنار گذاشته شده)», because its history stays worth
 * reading; retiring stopped its plan for good, so for it the plan is shown read-only — no add, no
 * row menu. The choice lives in the page (not the URL): every visit starts by picking.
 */
@Component({
  selector: 'app-pm-plans-page',
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
    MatIconButton,
    MatMenu,
    MatMenuContent,
    MatMenuItem,
    MatMenuTrigger,
    MatRow,
    MatRowDef,
    MatTable,
    PageHeader,
    PersianNumberPipe,
    PmStatusBadge,
    SearchableSelect,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack">
      <app-page-header
        heading="پرونده فنی تجهیزات"
        description="فعالیت‌های تعمیرات پیشگیرانهٔ هر تجهیز، دورهٔ آن‌ها و سابقهٔ انجامشان"
      />

      <div class="filter-bar" role="group" aria-label="انتخاب تجهیز">
        <app-searchable-select
          class="pm-plans__picker"
          label="تجهیز"
          [field]="picker.equipmentId"
          [options]="equipmentOptions()"
        />
      </div>

      @if (forbidden()) {
        <app-error-banner message="شما دسترسی لازم برای مشاهده این بخش را ندارید." />
      } @else if (equipmentResource.error()) {
        <app-error-banner
          message="فهرست تجهیزات بارگذاری نشد."
          retryLabel="تلاش دوباره"
          (retry)="equipmentResource.reload()"
        />
      } @else if (!selectedId()) {
        <app-empty-state
          message="برای دیدن برنامهٔ PM، یک تجهیز انتخاب کنید."
          description="فعالیت‌های برنامه و سابقهٔ PM تجهیز اینجا نمایش داده می‌شود."
        />
      } @else {
        @if (plan()?.retired) {
          <app-empty-state
            message="این تجهیز کنار گذاشته شده و برنامهٔ آن متوقف است."
            description="برنامه فقط برای مشاهده است؛ سابقهٔ PM آن در پایین آمده است."
          />
        }
        <!-- The picker names the equipment, so the sheet keeps one fixed heading. -->
        <app-data-sheet
          heading="برنامه PM"
          [count]="plan()?.planItems?.length ?? null"
          [loading]="planResource.isLoading()"
          loadingLabel="در حال بارگذاری برنامهٔ تجهیز"
        >
          <ng-container ngProjectAs="[sheetActions]">
            @if (editablePlan(); as equipment) {
              <button matButton="filled" type="button" (click)="openAddDialog(equipment)">
                <mat-icon appIcon="add" />
                افزودن فعالیت
              </button>
            }
          </ng-container>
          @if (planResource.status() === 'loading') {
            <!-- The sheet's progress bar says it. -->
          } @else if (planResource.error()) {
            <app-error-banner
              message="برنامهٔ تجهیز بارگذاری نشد."
              retryLabel="تلاش دوباره"
              (retry)="planResource.reload()"
            />
          } @else if (planItems().length === 0) {
            <app-empty-state
              message="هنوز فعالیتی در برنامهٔ این تجهیز نیست."
              [description]="editablePlan() ? 'با «افزودن فعالیت» اولین فعالیت را اضافه کنید.' : ''"
            />
          } @else {
            <table mat-table [dataSource]="planItems()">
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

              <ng-container matColumnDef="nextDueDate">
                <th mat-header-cell *matHeaderCellDef>
                  <span class="cell-end">موعد بعدی</span>
                </th>
                <td mat-cell *matCellDef="let item">
                  <span class="cell-end">{{ jalaliDate(item.nextDueDate) }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>
                  <span class="visually-hidden">عملیات</span>
                </th>
                <td mat-cell *matCellDef="let item">
                  <div class="cell-actions">
                    <button
                      matIconButton
                      class="icon-button--small"
                      type="button"
                      [attr.aria-label]="'عملیات بیشتر برای ' + item.activityName"
                      [matMenuTriggerFor]="rowMenu"
                      [matMenuTriggerData]="{ item }"
                      (click)="rememberMenuTrigger($event)"
                    >
                      <mat-icon>
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <circle cx="12" cy="5" r="1.2" />
                          <circle cx="12" cy="12" r="1.2" />
                          <circle cx="12" cy="19" r="1.2" />
                        </svg>
                      </mat-icon>
                    </button>
                  </div>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="planColumns()"></tr>
              <tr mat-row *matRowDef="let row; columns: planColumns()"></tr>
            </table>
          }
        </app-data-sheet>

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

              <!-- The notes are too long for a row; «جزئیات» shows the whole record, named by
                   activity and due date so each row's button is told apart from the others'. -->
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
                      (click)="openExecutionDetails(execution)"
                    >
                      <mat-icon appIcon="details" />
                      جزئیات
                    </button>
                  </div>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="historyColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: historyColumns"></tr>
            </table>
          }
        </app-data-sheet>
      }

      <mat-menu #rowMenu="matMenu">
        <ng-template matMenuContent let-item="item">
          <button mat-menu-item type="button" (click)="openChangeIntervalDialog(item)">
            <mat-icon>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M4 20l4-1L19 8l-3-3L5 16z" />
              </svg>
            </mat-icon>
            <span>ویرایش</span>
          </button>
          <button
            mat-menu-item
            class="menu-item--danger"
            type="button"
            (click)="openRemoveDialog(item)"
          >
            <mat-icon>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M4 7h16M10 11v6M14 11v6" />
                <path d="M6 7l1 13h10l1-13M9 7V4h6v3" />
              </svg>
            </mat-icon>
            <span>حذف</span>
          </button>
        </ng-template>
      </mat-menu>
    </div>
  `,
  styleUrl: './pm-plans-page.scss',
})
export class PmPlansPage {
  private readonly gateway = inject(EquipmentGateway);
  private readonly dialog = inject(MatDialog);

  protected readonly historyColumns = HISTORY_COLUMNS;
  protected readonly jalaliDate = formatJalaliCalendarDate;

  protected readonly equipmentResource = rxResource({
    stream: () => this.gateway.list(),
    defaultValue: [] as AppEquipment[],
  });

  private readonly pickerModel = signal({ equipmentId: '' });
  protected readonly picker = form(this.pickerModel);

  protected readonly selectedId = computed(() => this.pickerModel().equipmentId);

  private readonly allEquipment = computed<AppEquipment[]>(() =>
    this.equipmentResource.hasValue() ? this.equipmentResource.value() : [],
  );

  protected readonly equipmentOptions = computed<SearchableSelectOption[]>(() =>
    this.allEquipment().map((equipment) => ({
      value: equipment.id,
      label: equipment.retired ? equipment.name + ' (کنار گذاشته شده)' : equipment.name,
      searchTerms: [equipment.name],
    })),
  );

  protected readonly selectedName = computed(
    () => this.allEquipment().find((equipment) => equipment.id === this.selectedId())?.name ?? '',
  );

  /** Idle (no request) until a piece of equipment is picked. */
  protected readonly planResource = rxResource({
    params: () => this.selectedId() || undefined,
    stream: ({ params: id }) => this.gateway.get(id),
  });

  protected readonly historyResource = rxResource({
    params: () => this.selectedId() || undefined,
    stream: ({ params: id }) => this.gateway.maintenanceHistory(id),
    defaultValue: [] as AppMaintenanceExecution[],
  });

  protected readonly plan = computed<AppEquipmentDetail | undefined>(() =>
    this.planResource.hasValue() ? this.planResource.value() : undefined,
  );

  /** The chosen equipment while its plan can still change — not once it is retired. */
  protected readonly editablePlan = computed(() => {
    const equipment = this.plan();
    return equipment !== undefined && !equipment.retired ? equipment : undefined;
  });

  /** A retired equipment's plan has no row actions, so no actions column either. */
  protected readonly planColumns = computed(() =>
    this.editablePlan() ? PLAN_COLUMNS : PLAN_COLUMNS.filter((column) => column !== 'actions'),
  );

  protected readonly planItems = computed<AppPmPlanItem[]>(() => [
    ...(this.plan()?.planItems ?? []),
  ]);

  protected readonly history = computed<AppMaintenanceExecution[]>(() =>
    this.historyResource.hasValue() ? this.historyResource.value() : [],
  );

  protected readonly forbidden = computed(() => {
    const error = this.equipmentResource.error();
    return error instanceof HttpErrorResponse && error.status === 403;
  });

  /** In the viewer's own time zone, like every other instant the app shows. */
  protected performedAt(execution: AppMaintenanceExecution): string {
    const performed = new Date(execution.performedAt);
    return Number.isNaN(performed.getTime()) ? NONE : formatJalaliDateTime(performed);
  }

  /**
   * The row's «عملیات بیشتر» button, kept from its click. A dialog opened from one of the menu's
   * items would otherwise hand focus back to that item — gone with the menu — and so to <body>.
   */
  private menuTrigger: HTMLElement | undefined;

  protected rememberMenuTrigger(event: Event): void {
    this.menuTrigger = event.currentTarget as HTMLElement;
  }

  protected openAddDialog(equipment: AppEquipmentDetail): void {
    this.reloadPlanWhenTrue(
      this.dialog.open(AddPmPlanItemDialog, {
        data: { equipment: { id: equipment.id, name: equipment.name } },
      }),
    );
  }

  protected openChangeIntervalDialog(item: AppPmPlanItem): void {
    this.reloadPlanWhenTrue(
      this.dialog.open(ChangePmIntervalDialog, {
        data: { equipmentId: this.selectedId(), item },
        restoreFocus: this.menuTrigger,
      }),
    );
  }

  protected openRemoveDialog(item: AppPmPlanItem): void {
    const equipment = this.plan();
    if (equipment === undefined) {
      return;
    }
    this.reloadPlanWhenTrue(
      this.dialog.open(ConfirmRemovePmPlanItemDialog, {
        data: { equipment: { id: equipment.id, name: equipment.name }, item },
        restoreFocus: this.menuTrigger,
      }),
    );
  }

  /** The history row in full, notes included; read-only, so focus simply returns to the button. */
  protected openExecutionDetails(execution: AppMaintenanceExecution): void {
    this.dialog.open(PmExecutionDetailsDialog, {
      data: { equipmentName: this.selectedName(), execution },
    });
  }

  /** A plan change never rewrites the history, so only the plan is re-read. */
  private reloadPlanWhenTrue(ref: MatDialogRef<unknown, boolean>): void {
    ref.afterClosed().subscribe((changed) => {
      if (changed === true) {
        this.planResource.reload();
      }
    });
  }
}
