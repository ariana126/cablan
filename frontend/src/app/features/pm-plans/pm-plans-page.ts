import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import {
  MatExpansionPanel,
  MatExpansionPanelHeader,
  MatExpansionPanelTitle,
} from '@angular/material/expansion';
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
import { formatPersianNumber } from '../../core/i18n/persian-numerals';
import { matchesSearch } from '../../core/i18n/search-normalizer';
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
import { TableSearch } from '../../ui/table-search/table-search';
import {
  AddPmPlanItemDialog,
  AddPmPlanItemDialogData,
  AddPmPlanItemDialogResult,
} from './add-pm-plan-item-dialog';
import { ChangePmIntervalDialog } from './change-pm-interval-dialog';
import { ConfirmRemovePmPlanItemDialog } from './confirm-remove-pm-plan-item-dialog';
import { PmEquipmentCard } from './pm-equipment-card';
import { PmExecutionDetailsDialog } from './pm-execution-details-dialog';
import { Icon } from '../../ui/icon/icon';

const PLAN_COLUMNS = ['activity', 'intervalDays', 'firstDueDate', 'nextDueDate', 'actions'];
const HISTORY_COLUMNS = ['activity', 'dueDate', 'performedBy', 'performedAt', 'status', 'details'];

/** What a cell shows for a value that is not there, as the other report pages do. */
const NONE = '—';

/**
 * `/pm-plans` — «پرونده فنی تجهیزات» under «فنی» (issue #81). It opens on a board, the region
 * «تجهیزات دارای برنامه PM»: one card per active piece of equipment with at least one item in its
 * PM plan, drawn from `GET /api/equipment`'s `activePlanItemCount` alone (no request per card). A
 * card is a button named by the equipment and pressed while selected; clicking one shows its plan
 * («برنامه PM»: add with «افزودن فعالیت», change an item's interval or remove it from the row's
 * menu) and what has been done on it so far («سابقه PM»). Another card replaces both.
 *
 * Equipment with no plan yet has no card; «تعریف برنامه برای تجهیز» opens the add-item dialog with
 * a «تجهیز» picker over exactly that equipment, and on success the board re-reads and the new card
 * is selected. Every plan change re-reads the plan **and** the board, so the last item removed takes
 * the card off the board — but the selection stays, so the empty plan and its history stay in view.
 *
 * Retired equipment is never on the board: it sits in the collapsed «تجهیزات کنار گذاشته شده»
 * panel, because its history stays worth reading. Retiring stopped its plan for good, so for it the
 * plan is shown read-only — no add, no row menu. «جستجوی تجهیز» narrows the board and that panel by
 * name. The selection lives in the page (not the URL): every visit starts on the board.
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
    MatExpansionPanel,
    MatExpansionPanelHeader,
    MatExpansionPanelTitle,
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
    PmEquipmentCard,
    PmStatusBadge,
    TableSearch,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack">
      <app-page-header
        heading="پرونده فنی تجهیزات"
        description="فعالیت‌های تعمیرات پیشگیرانهٔ هر تجهیز، دورهٔ آن‌ها و سابقهٔ انجامشان"
      />

      @if (forbidden()) {
        <app-error-banner message="شما دسترسی لازم برای مشاهده این بخش را ندارید." />
      } @else {
        <app-data-sheet
          heading="تجهیزات دارای برنامه PM"
          [count]="equipmentResource.status() === 'loading' ? null : board().length"
          [loading]="equipmentResource.isLoading()"
          loadingLabel="در حال بارگذاری تجهیزات"
        >
          <app-table-search ngProjectAs="[sheetSearch]" label="جستجوی تجهیز" [(value)]="search" />
          <ng-container ngProjectAs="[sheetActions]">
            @if (noCandidates()) {
              <span class="pm-plans__note" [id]="noCandidatesId">
                همهٔ تجهیزات فعال برنامهٔ PM دارند.
              </span>
            }
            <button
              matButton="filled"
              type="button"
              disabledInteractive
              [disabled]="candidates().length === 0"
              [attr.aria-describedby]="noCandidates() ? noCandidatesId : null"
              (click)="openDefinePlanDialog()"
            >
              <mat-icon appIcon="add" />
              تعریف برنامه برای تجهیز
            </button>
          </ng-container>

          @if (equipmentResource.status() === 'loading') {
            <!-- The sheet's progress bar says it. -->
          } @else if (equipmentResource.error()) {
            <app-error-banner
              message="فهرست تجهیزات بارگذاری نشد."
              retryLabel="تلاش دوباره"
              (retry)="equipmentResource.reload()"
            />
          } @else if (board().length > 0) {
            <div class="pm-plans__board">
              @for (equipment of board(); track equipment.id) {
                <app-pm-equipment-card
                  [name]="equipment.name"
                  [detail]="activeItemsLabel(equipment)"
                  [selected]="equipment.id === selectedId()"
                  (choose)="select(equipment)"
                />
              }
            </div>
          } @else if (withPlan().length > 0) {
            <app-empty-state
              message="هیچ تجهیزی یافت نشد."
              actionLabel="پاک کردن جستجو"
              (action)="search.set('')"
            />
          } @else {
            <app-empty-state
              message="هنوز هیچ تجهیزی برنامهٔ PM ندارد."
              description="با «تعریف برنامه برای تجهیز» اولین برنامه را بسازید."
            />
          }
        </app-data-sheet>

        @if (retired().length > 0) {
          <!-- Retired equipment keeps its history, so it stays reachable — out of the way. -->
          <mat-expansion-panel class="pm-plans__retired">
            <mat-expansion-panel-header>
              <mat-panel-title>تجهیزات کنار گذاشته شده</mat-panel-title>
            </mat-expansion-panel-header>
            @if (matchingRetired().length > 0) {
              <div class="pm-plans__board pm-plans__board--flush">
                @for (equipment of matchingRetired(); track equipment.id) {
                  <app-pm-equipment-card
                    [name]="equipment.name"
                    detail="کنار گذاشته شده"
                    [selected]="equipment.id === selectedId()"
                    (choose)="select(equipment)"
                  />
                }
              </div>
            } @else {
              <p class="pm-plans__note">هیچ تجهیزی یافت نشد.</p>
            }
          </mat-expansion-panel>
        }
      }

      @if (!selectedId()) {
        @if (!forbidden()) {
          <app-empty-state
            message="برای دیدن برنامهٔ PM، یک تجهیز را انتخاب کنید."
            description="فعالیت‌های برنامه و سابقهٔ PM تجهیز اینجا نمایش داده می‌شود."
          />
        }
      } @else {
        @if (plan()?.retired) {
          <app-empty-state
            message="این تجهیز کنار گذاشته شده و برنامهٔ آن متوقف است."
            description="برنامه فقط برای مشاهده است؛ سابقهٔ PM آن در پایین آمده است."
          />
        }
        <!-- The pressed card names the equipment, so the sheet keeps one fixed heading. -->
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

  /** The selected equipment's id, `''` until a card is clicked. Outlives its card leaving the board. */
  protected readonly selectedId = signal('');
  /** «جستجوی تجهیز» — narrows the board and the retired panel by name. */
  protected readonly search = signal('');

  protected readonly noCandidatesId = 'pm-plans-no-candidates';

  private readonly allEquipment = computed<AppEquipment[]>(() =>
    this.equipmentResource.hasValue() ? this.equipmentResource.value() : [],
  );

  /** What the board may show: active equipment with at least one item in its plan, API order. */
  protected readonly withPlan = computed(() =>
    this.allEquipment().filter(
      (equipment) => !equipment.retired && equipment.activePlanItemCount > 0,
    ),
  );

  protected readonly board = computed(() => this.withPlan().filter(this.matchesSearch));

  protected readonly retired = computed(() =>
    this.allEquipment().filter((equipment) => equipment.retired),
  );

  protected readonly matchingRetired = computed(() => this.retired().filter(this.matchesSearch));

  /** Who «تعریف برنامه برای تجهیز» offers: active equipment with nothing in its plan yet. */
  protected readonly candidates = computed(() =>
    this.allEquipment().filter(
      (equipment) => !equipment.retired && equipment.activePlanItemCount === 0,
    ),
  );

  /** Only once the list is in — while it loads, «none left» would be a guess. */
  protected readonly noCandidates = computed(
    () => this.equipmentResource.status() === 'resolved' && this.candidates().length === 0,
  );

  private readonly matchesSearch = (equipment: AppEquipment): boolean =>
    matchesSearch(equipment.name, this.search());

  protected readonly selectedName = computed(
    () =>
      this.plan()?.name ??
      this.allEquipment().find((equipment) => equipment.id === this.selectedId())?.name ??
      '',
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

  protected activeItemsLabel(equipment: AppEquipment): string {
    return `${formatPersianNumber(equipment.activePlanItemCount)} فعالیت فعال`;
  }

  protected select(equipment: AppEquipment): void {
    this.selectedId.set(equipment.id);
  }

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
    this.reloadAfterChange(
      this.openAddItemDialog({ equipment: { id: equipment.id, name: equipment.name } }),
    );
  }

  /**
   * The add-item dialog with a «تجهیز» picker first, over the equipment that has no card. The
   * equipment it closes with is selected, its card appearing once the board has re-read.
   */
  protected openDefinePlanDialog(): void {
    const candidates = this.candidates();
    // `disabledInteractive` keeps the button focusable (so its reason can be read) and clickable.
    if (candidates.length === 0) {
      return;
    }
    this.openAddItemDialog({
      candidates: candidates.map((equipment) => ({ id: equipment.id, name: equipment.name })),
    })
      .afterClosed()
      .subscribe((equipmentId) => {
        if (!equipmentId) {
          return;
        }
        this.equipmentResource.reload();
        if (equipmentId === this.selectedId()) {
          this.planResource.reload();
        } else {
          this.selectedId.set(equipmentId);
        }
      });
  }

  private openAddItemDialog(
    data: AddPmPlanItemDialogData,
  ): MatDialogRef<AddPmPlanItemDialog, AddPmPlanItemDialogResult> {
    return this.dialog.open<
      AddPmPlanItemDialog,
      AddPmPlanItemDialogData,
      AddPmPlanItemDialogResult
    >(AddPmPlanItemDialog, { data });
  }

  protected openChangeIntervalDialog(item: AppPmPlanItem): void {
    this.reloadAfterChange(
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
    this.reloadAfterChange(
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

  /**
   * A plan change re-reads the plan and the board — a card's count moves, and the last item removed
   * takes the card off the board (the selection stays). It never rewrites the history.
   */
  private reloadAfterChange(ref: MatDialogRef<unknown, boolean | string | undefined>): void {
    ref.afterClosed().subscribe((changed) => {
      if (changed) {
        this.planResource.reload();
        this.equipmentResource.reload();
      }
    });
  }
}
