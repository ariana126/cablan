import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { form, submit } from '@angular/forms/signals';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatDivider } from '@angular/material/divider';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuContent, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
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

import {
  DateRangeFormModel,
  EMPTY_DATE_RANGE,
  appliedDateRange,
  dateRangeSchema,
  toIsoDateRange,
} from '../../core/date/date-range-form';
import { formatJalaliDateTime } from '../../core/date/jalali-datetime';
import { DateRange, DateRangePresets } from '../../ui/date-range-presets/date-range-presets';
import { JalaliDatetimeField } from '../../ui/jalali-datetime-field/jalali-datetime-field';
import {
  AppBomDetail,
  AppBomReportFilterOptions,
  AppBomReportFilters,
  AppBomReportPage,
  AppBomReportRow,
  BomReportGateway,
} from '../../core/boms/bom-report-gateway';
import { AppBom } from '../../core/boms/boms-gateway';
import { BomExportFormat } from '../../api/model';
import { FileSaver } from '../../core/files/file-saver';
import { CurrentUserStore } from '../../core/identity/current-user-store';
import { canManageBoms } from '../../core/identity/permissions';
import { AppProduct, ProductsGateway } from '../../core/products/products-gateway';
import {
  AppStandardBom,
  StandardBomsGateway,
} from '../../core/standard-boms/standard-boms-gateway';
import {
  ActiveFilterChip,
  multiValueFilterChips,
  withoutFilterValue,
} from '../../ui/active-filters/active-filter-chips';
import { ActiveFilters } from '../../ui/active-filters/active-filters';
import { CopyId } from '../../ui/copy-id-button/copy-id';
import { DataSheet } from '../../ui/data-sheet/data-sheet';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { FilterButton } from '../../ui/filter-button/filter-button';
import {
  CheckboxFilterDialog,
  CheckboxFilterDialogData,
  CheckboxFilterDialogResult,
} from '../../ui/checkbox-filter-dialog/checkbox-filter-dialog';
import { PageHeader } from '../../ui/page-header/page-header';
import {
  AppApprovalStatus,
  approvalStatusLabel,
  reviewerLabel,
  NO_REVIEWER_FILTER_LABEL,
  NO_REVIEWER_FILTER_VALUE,
} from '../../core/i18n/approval-labels';
import { BomFormDialog } from './bom-form-dialog';
import { BomPreviewDialog, BomPreviewDialogResult } from './bom-preview-dialog';
import {
  BomReportDetailDialog,
  BomReportDetailDialogData,
  BomReportDetailDialogResult,
} from './bom-report-detail-dialog';
import { ConfirmDeleteBomDialog, ConfirmDeleteBomTarget } from './confirm-delete-bom-dialog';

/** The nine business columns in the order `reporting-bom.feature` lists them, then the actions. */
const DISPLAYED_COLUMNS = [
  'orderNumber',
  'trackingNumber',
  'registeredAt',
  'registeredBy',
  'standardBomMiCode',
  'brand',
  'productName',
  'approvalStatus',
  'reviewedBy',
  'actions',
];

const DEFAULT_PAGE_SIZE = 20;

/** The «خروجی اکسل» menu: one item per row layout the API can build the workbook in. */
const BOM_EXPORT_FORMATS: readonly { key: BomExportFormat; label: string }[] = [
  { key: 'perMaterial', label: 'هر مواد اولیه یک ردیف' },
  { key: 'perBom', label: 'هر آنالیز روزانه یک ردیف' },
];

/** The nine Excel-style checkbox filters, keyed exactly as `AppBomReportFilters`/`BomReportFiltersDto`
 * shape them. "تاریخ و زمان ثبت" is deliberately not one of them — see this file's own date-range
 * section for why. */
type CheckboxFilterKey =
  | 'orderNumbers'
  | 'trackingNumbers'
  | 'brands'
  | 'componentNames'
  | 'standardBomMiCodes'
  | 'productNames'
  | 'registeredByUsers'
  | 'approvalStatuses'
  | 'reviewers';

const CHECKBOX_FILTER_FIELDS: readonly { key: CheckboxFilterKey; label: string }[] = [
  { key: 'orderNumbers', label: 'شماره سفارش' },
  { key: 'trackingNumbers', label: 'شماره ردیابی' },
  { key: 'brands', label: 'برند' },
  { key: 'componentNames', label: 'نام جز' },
  { key: 'standardBomMiCodes', label: 'کد MI' },
  { key: 'productNames', label: 'نام محصول' },
  { key: 'registeredByUsers', label: 'کنترلگر' },
  { key: 'approvalStatuses', label: 'وضعیت تایید' },
  { key: 'reviewers', label: 'تایید/رد کننده' },
];

/** The words a filter value is shown in — its Persian name for an approval status, «بدون تایید/رد
 * کننده» for the blank reviewer, itself for the rest, which are already the names the list shows. */
function filterValueLabel(key: CheckboxFilterKey, value: string): string {
  if (key === 'approvalStatuses') {
    return approvalStatusLabel(value as AppApprovalStatus);
  }
  if (key === 'reviewers' && value === NO_REVIEWER_FILTER_VALUE) {
    return NO_REVIEWER_FILTER_LABEL;
  }
  return value;
}

type CheckboxFilterSelections = Record<CheckboxFilterKey, string[] | undefined>;

const NO_CHECKBOX_FILTERS: CheckboxFilterSelections = {
  orderNumbers: undefined,
  trackingNumbers: undefined,
  brands: undefined,
  componentNames: undefined,
  standardBomMiCodes: undefined,
  productNames: undefined,
  registeredByUsers: undefined,
  approvalStatuses: undefined,
  reviewers: undefined,
};

/**
 * Narrows the detail read model to what the form dialog edits. `AppBomDetail` is a superset —
 * `standardBomMiCode`, `brand`, `productName`, `registeredBy`, `registeredAt`, `totalWeight` are all
 * display-only fields the form neither shows nor sends — so this is a projection, not a conversion,
 * and it is the reason editing needs no `GET /boms` and no second endpoint.
 */
function toAppBom(detail: AppBomDetail): AppBom {
  return {
    id: detail.id,
    standardBomId: detail.standardBomId,
    orderNumber: detail.orderNumber,
    trackingNumber: detail.trackingNumber,
    description: detail.description,
    components: detail.components.map((component) => ({
      id: component.id,
      name: component.name,
      materials: component.materials.map((material) => ({
        id: material.id,
        name: material.name,
        weight: material.weight,
      })),
    })),
  };
}

/**
 * The one page for daily BOMs: "مشاهده آنالیز روزانه" (`reporting-bom.feature`) and
 * "ثبت آنالیز روزانه" (`registring-bom.feature`) are the same screen, not two. Browsing, filtering
 * and exporting are the گزارشگیر role's read side; registering, editing and deleting are the
 * کنترلگر's write side; both act on the one list. There is no separate `/boms/report`.
 *
 * Listing carries no role restriction at all (any authenticated user may browse), so the role
 * decides only which *actions* the page offers, never whether it renders: `canManage()` hides
 * افزودن, ویرایش and حذف from a گزارشگیر, on the rows and on the detail card alike, and leaves the
 * table, the filters and the Excel export exactly where they are.
 * `bom-form-dialog`/`confirm-delete-bom-dialog` still map a 403 to an access-denied message — that
 * is the answer to a role that changed mid-session, not dead code, since the API is the only real
 * boundary. The list paginates and filters entirely server-side through
 * `POST /boms/report`, and never fetches or holds the full dataset — the paginator's `length` is the
 * response's own `total`, not this page's row count. That is also why editing starts from a
 * `GET /boms/:id` rather than from a full `GET /boms`: a daily BOM is transactional, unbounded data,
 * and the row the visitor clicked is a projection that carries neither the composition nor the
 * `standardBomId` the form needs.
 *
 * **Filterable fields do not mirror the list's columns 1:1, on purpose**: "نام جز" is filterable but
 * never a column (components only ever appear in the detail dialog), and "تاریخ و زمان ثبت" is a
 * column filtered by a range instead (below). The filter buttons below live in their own toolbar
 * rather than inside a column header for exactly that reason.
 *
 * **"تاریخ و زمان ثبت" gets a persistent range control, never an Excel-style checkbox panel** —
 * `filter-options` returns no distinct values for it, so there is nothing to build a checkbox list
 * from. It stays visible at all times (not behind its own "فیلتر" button) since applying it is a
 * single action, not a multi-value selection to build up.
 *
 * **A tenth "عملیات" column carries the "جزئیات", "ویرایش" and "حذف" buttons.** The feature's own
 * "لیست فقط شامل ستون های زیر باشد" rule enumerates the nine *business* columns this page must
 * never leak متراژ استاندارد/اجزا/مواد اولیه/توضیحات/جمع وزن مواد اولیه into — it does not forbid a
 * UI affordance column, and a table with per-row actions needs some accessible way to trigger them
 * that isn't a `div` click target or an ARIA role forced onto a table row.
 *
 * **The detail card offers the same two write actions**, and routes them back here rather than
 * opening anything itself (`BomReportDetailDialogResult`) — one code path per action, shared with
 * the row buttons, and never two stacked modals.
 */
@Component({
  selector: 'app-boms-page',
  imports: [
    ActiveFilters,
    DataSheet,
    DateRangePresets,
    EmptyState,
    ErrorBanner,
    FilterButton,
    JalaliDatetimeField,
    MatButton,
    MatCell,
    MatCellDef,
    MatColumnDef,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatDivider,
    MatHeaderRowDef,
    MatIcon,
    MatIconButton,
    MatMenu,
    MatMenuContent,
    MatMenuItem,
    MatMenuTrigger,
    MatPaginator,
    MatRow,
    MatRowDef,
    MatTable,
    PageHeader,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack">
      <app-page-header
        heading="آنالیز های روزانه"
        description="ثبت و بررسی وزن مواد اولیهٔ هر سفارش در برابر آنالیز استاندارد"
      >
        <!-- Secondary actions first, the one filled action last. -->
        <button
          pageHeaderActions
          matButton="outlined"
          type="button"
          [matMenuTriggerFor]="exportMenu"
          [disabled]="exporting()"
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
              <path d="M12 4v11" />
              <path d="M7 10l5 5 5-5" />
              <path d="M5 20h14" />
            </svg>
          </mat-icon>
          خروجی اکسل
          <mat-icon iconPositionEnd>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </mat-icon>
        </button>
        @if (canManage()) {
          <button pageHeaderActions matButton="filled" type="button" (click)="openCreateDialog()">
            <mat-icon>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </mat-icon>
            افزودن آنالیز روزانه
          </button>
        }
      </app-page-header>

      <mat-menu #exportMenu="matMenu">
        @for (format of exportFormats; track format.key) {
          <button mat-menu-item type="button" (click)="onExport(format.key)">
            {{ format.label }}
          </button>
        }
      </mat-menu>

      <!-- The date range: presets, the two bounds and «اعمال بازه», on a low band. -->
      <div class="filter-bar" role="group" aria-label="بازهٔ ثبت">
        <app-date-range-presets
          label="بازه‌های آماده تاریخ و زمان ثبت"
          (rangeSelected)="onPresetSelected($event)"
        />

        <form
          novalidate
          class="filter-bar__form"
          (submit)="onApplyDateRange(); $event.preventDefault()"
        >
          <app-jalali-datetime-field
            [field]="dateRangeForm.from"
            dateLabel="از تاریخ ثبت"
            timeLabel="از ساعت ثبت"
            boundName="آغاز بازه ثبت"
          />

          <app-jalali-datetime-field
            [field]="dateRangeForm.to"
            dateLabel="تا تاریخ ثبت"
            timeLabel="تا ساعت ثبت"
            boundName="پایان بازه ثبت"
          />

          <button matButton="outlined" type="submit">اعمال بازه</button>
        </form>
      </div>

      <app-data-sheet
        heading="فهرست آنالیزها"
        [count]="loading() || reportResource.error() ? null : total()"
        [loading]="loading()"
        loadingLabel="در حال بارگذاری فهرست آنالیز های روزانه"
      >
        <!-- One button per filterable field. They live in the sheet's bar rather than in a column
             header: the filterable fields do not mirror the columns 1:1 (see this class's comment). -->
        <div sheetFilters class="sheet-filters" role="group" aria-label="فیلترهای گزارش">
          @for (field of checkboxFilterFields; track field.key) {
            <app-filter-button
              [label]="field.label"
              [selectedCount]="selectedCount(field.key)"
              [disabled]="filterOptionsResource.isLoading()"
              (pressed)="openFilterDialog(field)"
            />
          }
        </div>

        <app-active-filters
          sheetChips
          [chips]="activeChips()"
          (removed)="onRemoveFilter($event)"
          (clearedAll)="onClearFilters()"
        />

        @if (loading()) {
          <!-- The sheet's progress bar says it; nothing to draw until the answer arrives. -->
        } @else if (reportResource.error()) {
          <app-error-banner
            message="فهرست آنالیز های روزانه بارگذاری نشد."
            retryLabel="تلاش دوباره"
            (retry)="reportResource.reload()"
          />
        } @else if (rows().length === 0) {
          <app-empty-state
            message="هیچ آنالیز روزانه‌ای یافت نشد."
            [actionLabel]="hasActiveFilters() ? 'پاک کردن فیلترها' : undefined"
            (action)="onClearFilters()"
          />
        } @else {
          <table mat-table [dataSource]="rows()">
            <ng-container matColumnDef="orderNumber">
              <th mat-header-cell *matHeaderCellDef>شماره سفارش</th>
              <td mat-cell *matCellDef="let row">
                <span class="cell-id">{{ row.orderNumber }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="trackingNumber">
              <th mat-header-cell *matHeaderCellDef>شماره ردیابی</th>
              <td mat-cell *matCellDef="let row">
                <span class="cell-id">{{ row.trackingNumber }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="registeredAt">
              <th mat-header-cell *matHeaderCellDef>
                <span class="cell-end">تاریخ و زمان ثبت</span>
              </th>
              <td mat-cell *matCellDef="let row">
                <span class="cell-end">{{ formatRegisteredAt(row.registeredAt) }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="registeredBy">
              <th mat-header-cell *matHeaderCellDef>کنترلگر</th>
              <td mat-cell *matCellDef="let row">{{ row.registeredBy }}</td>
            </ng-container>

            <ng-container matColumnDef="standardBomMiCode">
              <th mat-header-cell *matHeaderCellDef>کد MI</th>
              <td mat-cell *matCellDef="let row">
                <span class="cell-id">{{ row.standardBomMiCode }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="brand">
              <th mat-header-cell *matHeaderCellDef>برند</th>
              <td mat-cell *matCellDef="let row">{{ row.brand }}</td>
            </ng-container>

            <ng-container matColumnDef="productName">
              <th mat-header-cell *matHeaderCellDef>نام محصول</th>
              <td mat-cell *matCellDef="let row">{{ row.productName }}</td>
            </ng-container>

            <ng-container matColumnDef="approvalStatus">
              <th mat-header-cell *matHeaderCellDef>وضعیت تایید</th>
              <td mat-cell *matCellDef="let row">{{ approvalStatusLabel(row.approvalStatus) }}</td>
            </ng-container>

            <ng-container matColumnDef="reviewedBy">
              <th mat-header-cell *matHeaderCellDef>تایید/رد کننده</th>
              <td mat-cell *matCellDef="let row">{{ reviewerLabel(row.reviewedBy) }}</td>
            </ng-container>

            <!-- The row's actions: «جزئیات» is its most common one, and everything else (edit, copy
                 the id, delete) is in the overflow menu — one menu for the table, filled with the
                 row it was opened from. The header is for a screen reader only. -->
            <!-- Pinned to the inline-end edge: with nine business columns the table can outgrow
                 its sheet and scroll sideways, and the row's actions must stay in reach. -->
            <ng-container matColumnDef="actions" stickyEnd>
              <th mat-header-cell *matHeaderCellDef>
                <span class="visually-hidden">عملیات</span>
              </th>
              <td mat-cell *matCellDef="let row">
                <div class="cell-actions">
                  <button
                    matButton
                    class="button--small"
                    type="button"
                    [attr.aria-label]="'جزئیات ' + row.orderNumber"
                    (click)="openDetailDialog(row)"
                  >
                    جزئیات
                  </button>
                  <button
                    matIconButton
                    class="icon-button--small"
                    type="button"
                    [attr.aria-label]="'عملیات بیشتر برای ' + row.orderNumber"
                    [matMenuTriggerFor]="rowMenu"
                    [matMenuTriggerData]="{ row }"
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

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
          </table>
        }

        @if (!loading() && !reportResource.error() && rows().length > 0) {
          <mat-paginator
            sheetFooter
            [length]="total()"
            [pageIndex]="pageIndex()"
            [pageSize]="pageSize()"
            [pageSizeOptions]="[10, 20, 50]"
            (page)="onPage($event)"
          />
        }
      </app-data-sheet>

      <mat-menu #rowMenu="matMenu">
        <ng-template matMenuContent let-row="row">
          @if (canManage()) {
            <button
              mat-menu-item
              type="button"
              [disabled]="openingEditFor() !== undefined"
              (click)="onEditRow(row)"
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
                  <path d="M4 20l4-1L19 8l-3-3L5 16z" />
                </svg>
              </mat-icon>
              <span>ویرایش</span>
            </button>
          }
          <button mat-menu-item type="button" (click)="copyId.copy(row.id)">
            <mat-icon>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="9" y="9" width="12" height="12" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </mat-icon>
            <span>کپی شناسه</span>
          </button>
          @if (canManage()) {
            <mat-divider />
            <button
              mat-menu-item
              class="menu-item--danger"
              type="button"
              (click)="openDeleteDialog(row)"
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
          }
        </ng-template>
      </mat-menu>
    </div>
  `,
  styleUrl: './boms-page.scss',
})
export class BomsPage {
  private readonly gateway = inject(BomReportGateway);
  private readonly standardBomsGateway = inject(StandardBomsGateway);
  private readonly productsGateway = inject(ProductsGateway);
  private readonly currentUser = inject(CurrentUserStore);
  private readonly dialog = inject(MatDialog);
  private readonly fileSaver = inject(FileSaver);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly copyId = inject(CopyId);

  protected readonly displayedColumns = DISPLAYED_COLUMNS;
  protected readonly checkboxFilterFields = CHECKBOX_FILTER_FIELDS;
  protected readonly exportFormats = BOM_EXPORT_FORMATS;
  protected readonly exporting = signal(false);
  protected readonly approvalStatusLabel = approvalStatusLabel;
  protected readonly reviewerLabel = reviewerLabel;

  /** The id of the daily BOM whose `GET /boms/:id` is in flight ahead of the edit form, or
   * `undefined` while none is — a second click before the first answer would otherwise open two
   * form dialogs on the same row. */
  protected readonly openingEditFor = signal<string | undefined>(undefined);

  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  private readonly checkboxFilters = signal<CheckboxFilterSelections>(NO_CHECKBOX_FILTERS);
  private readonly dateRangeFilters = signal<
    Pick<AppBomReportFilters, 'registeredAtFrom' | 'registeredAtTo'>
  >({});

  private readonly filters = computed<AppBomReportFilters>(() => {
    const { approvalStatuses, ...checkboxFilters } = this.checkboxFilters();
    return {
      ...checkboxFilters,
      // The dialog only ever offers the statuses `filter-options` listed, so these are statuses.
      approvalStatuses: approvalStatuses as AppApprovalStatus[] | undefined,
      ...this.dateRangeFilters(),
    };
  });

  /** How many values are chosen for a field; 0 while it has no filter. */
  protected selectedCount(key: CheckboxFilterKey): number {
    return this.checkboxFilters()[key]?.length ?? 0;
  }

  /** One chip per chosen value: «برند: کابلان» and «برند: لگراند», each removable on its own. */
  protected readonly activeChips = computed<readonly ActiveFilterChip[]>(() =>
    multiValueFilterChips(CHECKBOX_FILTER_FIELDS, this.checkboxFilters(), filterValueLabel),
  );

  protected readonly hasActiveFilters = computed(() => this.activeChips().length > 0);

  protected onRemoveFilter(chip: ActiveFilterChip): void {
    this.checkboxFilters.update((current) => withoutFilterValue(current, chip));
    this.pageIndex.set(0);
  }

  protected onClearFilters(): void {
    this.checkboxFilters.set(NO_CHECKBOX_FILTERS);
    this.pageIndex.set(0);
  }

  /**
   * بازرس کنترل کیفیت، مدیریت and مدیر سیستم may register, edit or delete a daily BOM; گزارشگیر
   * may not. `canManageBoms` in `core/identity/permissions.ts` is where that rule lives — note it
   * is a *wider* set than the standard-BOM page's, which excludes the QC inspector. The role comes
   * from `GET /users/me`, already resolved by `guardedRoute` before this page is constructed.
   *
   * It gates the affordances only, never the list: browsing is open to every authenticated user and
   * is served by `POST /boms/report`, which carries no role restriction at all.
   */
  protected readonly canManage = computed(() => canManageBoms(this.currentUser.role()));

  /**
   * The create/edit form's standard-BOM picker needs every standard BOM's *current* composition —
   * see `bom-form-dialog.ts` — and the form is opened from a click, not from a navigation, so it
   * cannot fetch it itself without making the dialog wait. Fetched eagerly here instead: standard
   * BOMs are master data, bounded by the product catalogue, unlike the daily BOMs this page's list
   * deliberately never holds in full.
   *
   * Only for a role that can open that form, though — `params` returning `undefined` leaves the
   * resource idle. `GET /standard-boms` would not refuse a گزارشگیر, so this is not about a 403;
   * it is a request for a dialog they will never see.
   */
  protected readonly standardBomsResource = rxResource({
    params: () => (this.canManage() ? {} : undefined),
    stream: () => this.standardBomsGateway.list(),
    defaultValue: [] as AppStandardBom[],
  });

  /** The same form names the chosen standard BOM's product, which a standard BOM knows only by id
   * — so the product list is fetched alongside it, eagerly and for the same roles, for the same
   * reasons. `GET /products` carries no role restriction either. */
  protected readonly productsResource = rxResource({
    params: () => (this.canManage() ? {} : undefined),
    stream: () => this.productsGateway.list(),
    defaultValue: [] as AppProduct[],
  });

  protected readonly filterOptionsResource = rxResource({
    stream: () => this.gateway.filterOptions(),
    defaultValue: {
      orderNumbers: [],
      trackingNumbers: [],
      brands: [],
      componentNames: [],
      standardBomMiCodes: [],
      productNames: [],
      registeredByUsers: [],
      approvalStatuses: [],
      reviewers: [],
    } as AppBomReportFilterOptions,
  });

  protected readonly reportResource = rxResource({
    params: () => ({
      page: this.pageIndex() + 1,
      pageSize: this.pageSize(),
      filters: this.filters(),
    }),
    stream: ({ params }) => this.gateway.report(params.page, params.pageSize, params.filters),
    defaultValue: { items: [], total: 0 } as AppBomReportPage,
  });

  protected readonly loading = computed(() => this.reportResource.isLoading());
  protected readonly rows = computed<AppBomReportRow[]>(() => this.reportResource.value().items);
  protected readonly total = computed(() => this.reportResource.value().total);

  private readonly dateRangeModel = signal<DateRangeFormModel>(EMPTY_DATE_RANGE);

  protected readonly dateRangeForm = form(this.dateRangeModel, dateRangeSchema);

  protected formatRegisteredAt(iso: string): string {
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? '—' : formatJalaliDateTime(parsed);
  }

  protected onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  protected onApplyDateRange(): Promise<boolean> {
    return submit(this.dateRangeForm, async () => {
      const { from, to } = toIsoDateRange(this.dateRangeModel());

      this.dateRangeFilters.set({ registeredAtFrom: from, registeredAtTo: to });
      this.pageIndex.set(0);
      return undefined;
    });
  }

  /** A preset fills the two fields and applies immediately — pressing «۷ روز گذشته» and then having
   * to press «اعمال بازه» as well would make the shortcut no shorter than picking the dates. The
   * nine checkbox filters are left alone: this presets the range, it does not reset the report. */
  protected onPresetSelected(range: DateRange): void {
    this.dateRangeModel.set(appliedDateRange(range.from, range.to));
    void this.onApplyDateRange();
  }

  /** Exports the entire *filtered* result set — `this.filters()`, the same computed signal
   * `reportResource` consumes — never the currently rendered page: there is no page/pageSize
   * parameter on `BomReportGateway#export` at all, by design, so nothing here narrows the request to
   * what happens to be on screen. */
  protected onExport(format: BomExportFormat): void {
    this.exporting.set(true);
    this.gateway.export(format, this.filters()).subscribe({
      next: (file) => {
        this.fileSaver.save(file.blob, file.fileName);
        this.exporting.set(false);
      },
      error: () => {
        this.exporting.set(false);
        this.snackBar.open('خروجی اکسل گرفته نشد.', 'باشه', { duration: 5000 });
      },
    });
  }

  protected openFilterDialog(field: { key: CheckboxFilterKey; label: string }): void {
    const values = this.filterValues(field.key);
    const data: CheckboxFilterDialogData = {
      fieldLabel: field.label,
      options: values.map((value) => ({ value, label: filterValueLabel(field.key, value) })),
      selectedValues: this.checkboxFilters()[field.key],
    };

    this.dialog
      .open(CheckboxFilterDialog, { data })
      .afterClosed()
      .subscribe((result: CheckboxFilterDialogResult | '' | undefined) => {
        if (!result) {
          return;
        }
        this.checkboxFilters.update((current) => ({ ...current, [field.key]: result.selected }));
        this.pageIndex.set(0);
      });
  }

  /**
   * The values a field's dialog offers. `filter-options` lists only named reviewers, so while any
   * daily BOM is pending the reviewer field gets the blank one too — otherwise ticking every
   * listed reviewer would read as "no filter" and still let the pending rows through.
   */
  private filterValues(key: CheckboxFilterKey): string[] {
    const options = this.filterOptionsResource.value();
    return key === 'reviewers' && options.approvalStatuses.includes('pending')
      ? [...options.reviewers, NO_REVIEWER_FILTER_VALUE]
      : options[key];
  }

  protected openDetailDialog(row: AppBomReportRow): void {
    const data: BomReportDetailDialogData = {
      id: row.id,
      orderNumber: row.orderNumber,
      canManage: this.canManage(),
    };
    this.dialog
      .open(BomReportDetailDialog, { data })
      .afterClosed()
      .subscribe((result: BomReportDetailDialogResult | '' | undefined) => {
        if (!result) {
          return;
        }
        if (result.action === 'edit') {
          // The card fetched the detail to render it, so the edit path starts from what it already
          // has — no second `GET /boms/:id`, unlike `onEditRow` below.
          this.openEditDialog(toAppBom(result.detail));
        } else {
          this.openDeleteDialog(row);
        }
      });
  }

  protected openCreateDialog(): void {
    this.dialog
      .open(BomFormDialog, {
        data: {
          mode: 'create',
          standardBoms: this.standardBomsResource.value(),
          products: this.productsResource.value(),
        },
      })
      .afterClosed()
      .subscribe((registeredId: string | undefined) => {
        if (registeredId) {
          this.reportResource.reload();
          this.openPreviewDialog(registeredId);
        }
      });
  }

  /** Right after a register: how far each material line sits from the standard (issue #50). Its
   * «ویرایش» takes the same path as a row's — fetch the whole daily BOM, then the edit form. */
  private openPreviewDialog(id: string): void {
    this.dialog
      .open(BomPreviewDialog, { data: { id } })
      .afterClosed()
      .subscribe((result: BomPreviewDialogResult | undefined) => {
        if (result === 'edit') {
          this.editBom(id);
        }
      });
  }

  /**
   * A report row is a projection: it carries neither the composition nor the `standardBomId` the
   * form pre-fills from, so the whole daily BOM is fetched first. Only this one is — the page never
   * holds them all.
   */
  protected onEditRow(row: AppBomReportRow): void {
    this.editBom(row.id);
  }

  private editBom(id: string): void {
    this.openingEditFor.set(id);
    this.gateway.get(id).subscribe({
      next: (detail) => {
        this.openingEditFor.set(undefined);
        this.openEditDialog(toAppBom(detail));
      },
      error: () => {
        this.openingEditFor.set(undefined);
        this.snackBar.open('آنالیز روزانه برای ویرایش بارگذاری نشد.', 'باشه', { duration: 5000 });
      },
    });
  }

  private openEditDialog(bom: AppBom): void {
    this.dialog
      .open(BomFormDialog, {
        data: {
          mode: 'edit',
          bom,
          standardBoms: this.standardBomsResource.value(),
          products: this.productsResource.value(),
        },
      })
      .afterClosed()
      .subscribe((editedId: string | undefined) => {
        if (editedId) {
          this.reportResource.reload();
        }
      });
  }

  protected openDeleteDialog(bom: ConfirmDeleteBomTarget): void {
    this.dialog
      .open(ConfirmDeleteBomDialog, {
        data: { bom: { id: bom.id, orderNumber: bom.orderNumber } },
      })
      .afterClosed()
      .subscribe((deleted) => {
        if (deleted) {
          this.reportResource.reload();
        }
      });
  }
}
