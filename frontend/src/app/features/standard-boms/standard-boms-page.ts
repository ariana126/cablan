import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';
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
  AppStandardBomFilterOptions,
  AppStandardBomReportFilters,
  AppStandardBomReportPage,
  AppStandardBomReportRow,
  AppStandardBomReportSortBy,
  AppStandardBomReportSortDir,
  StandardBomReportGateway,
} from '../../core/standard-boms/standard-bom-report-gateway';
import { StandardBomExportFormat } from '../../api/model';
import { FileSaver } from '../../core/files/file-saver';
import { CurrentUserStore } from '../../core/identity/current-user-store';
import { ACTIVE_LABELS } from '../../core/i18n/active-labels';
import { canManageStandardBoms } from '../../core/identity/permissions';
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
import { PageHeader } from '../../ui/page-header/page-header';
import {
  ConfirmDeleteStandardBomDialog,
  ConfirmDeleteStandardBomTarget,
} from './confirm-delete-standard-bom-dialog';
import { StandardBomFormDialog } from './standard-bom-form-dialog';
import {
  StandardBomReportDetailDialog,
  StandardBomReportDetailDialogData,
  StandardBomReportDetailDialogResult,
} from './standard-bom-report-detail-dialog';
import {
  StandardBomFilterOption,
  StandardBomFilterValue,
  StandardBomReportFilterDialog,
  StandardBomReportFilterDialogData,
  StandardBomReportFilterDialogResult,
} from './standard-bom-report-filter-dialog';

const DISPLAYED_COLUMNS = ['miCode', 'productName', 'brand', 'active', 'actions'];

const DEFAULT_PAGE_SIZE = 20;

/** The «خروجی اکسل» menu: one item per row layout the API can build the workbook in. */
const STANDARD_BOM_EXPORT_FORMATS: readonly { key: StandardBomExportFormat; label: string }[] = [
  { key: 'perMaterial', label: 'هر مواد اولیه یک ردیف' },
  { key: 'perBom', label: 'هر آنالیز استاندارد یک ردیف' },
];

/** The five Excel-style checkbox filters, keyed exactly as `AppStandardBomReportFilters` shapes them. */
type CheckboxFilterKey =
  'brands' | 'activeStatuses' | 'productNames' | 'componentNames' | 'miCodes';

interface CheckboxFilterDescriptor {
  readonly key: CheckboxFilterKey;
  readonly label: string;
}

const CHECKBOX_FILTER_FIELDS: readonly CheckboxFilterDescriptor[] = [
  { key: 'brands', label: 'برند' },
  { key: 'activeStatuses', label: 'فعال' },
  { key: 'productNames', label: 'نام محصول' },
  { key: 'componentNames', label: 'نام جز' },
  { key: 'miCodes', label: 'کد MI' },
];

/** Per-field selections: `activeStatuses` holds booleans, the rest hold strings. */
interface CheckboxFilterSelections {
  brands: string[] | undefined;
  activeStatuses: boolean[] | undefined;
  productNames: string[] | undefined;
  componentNames: string[] | undefined;
  miCodes: string[] | undefined;
}

const NO_CHECKBOX_FILTERS: CheckboxFilterSelections = {
  brands: undefined,
  activeStatuses: undefined,
  productNames: undefined,
  componentNames: undefined,
  miCodes: undefined,
};

/** Builds the option list the filter dialog renders. Booleans get بله/خیر; strings render as-is. */
function toFilterOptions<V extends StandardBomFilterValue>(
  values: readonly V[],
  labels: ReadonlyMap<V, string> = new Map(),
): StandardBomFilterOption<V>[] {
  return values.map((value) => ({ value, label: labels.get(value) ?? String(value) }));
}

/**
 * The one page for standard BOMs: "گزارش آنالیز های استاندارد" and
 * "ثبت آنالیز استاندارد" (`registring-standard-bom.feature`) are the same screen, not two.
 * Browsing, filtering and exporting are the گزارشگیر (Reporter) role's read side; registering,
 * editing and deleting are the Management/System-Admin write side; both act on the one list. There
 * is no separate `/standard-boms/report`. Mirrors `features/boms/boms-page.ts` throughout.
 *
 * The list paginates and filters entirely server-side through `POST /standard-boms/report`, and
 * never fetches or holds the full dataset — the paginator's `length` is the response's own `total`,
 * not this page's row count. `standardBomsResource` is not a second copy of that list: it is the
 * master data the *form* needs (see its own comment), and it is where an edit's starting values come
 * from, since a report row carries neither `productId` nor the composition.
 *
 * **The list view intentionally does NOT show standardLength, description, components, materials or
 * total weight** — those are only in the detail dialog (`standard-bom-report-detail-dialog.ts`),
 * reached through the "جزئیات" button in the "عملیات" column.
 *
 * **Filterable fields do not mirror the list's columns 1:1, on purpose**: "نام جز" is filterable
 * but never a column (components only ever appear in the detail dialog). "کد MI" is both a column
 * and a filter, mirroring `bom-reports-page.ts`'s own `standardBomMiCodes` filter.
 *
 * **"فعال" carries a boolean filter panel**, not a string one — its `activeStatuses: boolean[]`
 * is rendered as بله/خیر checkboxes but the underlying type stays boolean all the way through the
 * gateway to the wire (see `StandardBomReportFilterDialog<V>`).
 *
 * **Default sort is ascending by product name**, the backend's own default, and is sent on every
 * request as `sortBy: 'productName', sortDir: 'asc'` so the page is sortable to that shape from
 * day one without depending on what the backend returns when those fields are absent. **Only
 * "نام محصول" is sortable** — the other columns deliberately do not carry a `mat-sort-header`,
 * because the feature does not exercise them and the backend's `search` query only orders by
 * `productName` (or its `miCode` fallback).
 *
 * **An "عملیات" column carries the "جزئیات", "ویرایش" and "حذف" buttons** — a table with per-row
 * actions needs some accessible way to trigger them that isn't a `div` click target or an ARIA role
 * forced onto a table row. **The detail card offers the same two write actions**, and routes them
 * back here rather than opening anything itself (`StandardBomReportDetailDialogResult`) — one code
 * path per action, shared with the row buttons, and never two stacked modals.
 *
 * **متراژ استاندارد is not a column**, though the pre-merge management list had one: the report's
 * own "the list shows only these fields" rule governs this table now, and standardLength lives in
 * the detail card alongside اجزا، مواد اولیه، توضیحات and جمع وزن مواد اولیه.
 */
@Component({
  selector: 'app-standard-boms-page',
  imports: [
    ActiveFilters,
    DataSheet,
    EmptyState,
    ErrorBanner,
    FilterButton,
    MatButton,
    MatCell,
    MatCellDef,
    MatColumnDef,
    MatDivider,
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
        heading="آنالیز های استاندارد"
        description="وزن مرجع هر مواد اولیه برای هر محصول؛ آنالیزهای روزانه با این مقادیر مقایسه می‌شوند"
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
            افزودن آنالیز استاندارد
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

      <app-data-sheet
        heading="فهرست آنالیزهای استاندارد"
        [count]="loading() || reportResource.error() ? null : total()"
        [loading]="loading()"
        loadingLabel="در حال بارگذاری فهرست آنالیز های استاندارد"
      >
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
            message="فهرست آنالیز های استاندارد بارگذاری نشد."
            retryLabel="تلاش دوباره"
            (retry)="reportResource.reload()"
          />
        } @else if (rows().length === 0) {
          <app-empty-state
            message="هیچ آنالیز استانداردی یافت نشد."
            [actionLabel]="hasActiveFilters() ? 'پاک کردن فیلترها' : undefined"
            (action)="onClearFilters()"
          />
        } @else {
          <table mat-table [dataSource]="rows()">
            <ng-container matColumnDef="miCode">
              <th mat-header-cell *matHeaderCellDef>کد MI</th>
              <td mat-cell *matCellDef="let row">
                <span class="cell-id">{{ row.miCode }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="productName">
              <th
                mat-header-cell
                *matHeaderCellDef
                tabindex="0"
                role="columnheader"
                [attr.aria-sort]="sortDir() === 'asc' ? 'ascending' : 'descending'"
                (click)="toggleProductNameSort()"
                (keydown.enter)="toggleProductNameSort()"
                (keydown.space)="toggleProductNameSort(); $event.preventDefault()"
              >
                نام محصول
              </th>
              <td mat-cell *matCellDef="let row">{{ row.productName }}</td>
            </ng-container>

            <ng-container matColumnDef="brand">
              <th mat-header-cell *matHeaderCellDef>برند</th>
              <td mat-cell *matCellDef="let row">{{ row.brand }}</td>
            </ng-container>

            <ng-container matColumnDef="active">
              <th mat-header-cell *matHeaderCellDef>فعال</th>
              <td mat-cell *matCellDef="let row">{{ formatActive(row.active) }}</td>
            </ng-container>

            <!-- «جزئیات» is the row's most common action; edit, copy the id and delete are in the
                 overflow menu — one menu for the table, filled with the row it was opened from. -->
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>
                <span class="visually-hidden">عملیات</span>
              </th>
              <td mat-cell *matCellDef="let row">
                <div class="cell-actions">
                  <button
                    matButton
                    class="button--small"
                    type="button"
                    [attr.aria-label]="'جزئیات ' + row.miCode"
                    (click)="openDetailDialog(row)"
                  >
                    جزئیات
                  </button>
                  <button
                    matIconButton
                    class="icon-button--small"
                    type="button"
                    [attr.aria-label]="'عملیات بیشتر برای ' + row.miCode"
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
            <button mat-menu-item type="button" (click)="onEditRow(row)">
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
  styleUrl: './standard-boms-page.scss',
})
export class StandardBomsPage {
  private readonly gateway = inject(StandardBomReportGateway);
  private readonly standardBomsGateway = inject(StandardBomsGateway);
  private readonly productsGateway = inject(ProductsGateway);
  private readonly currentUser = inject(CurrentUserStore);
  private readonly dialog = inject(MatDialog);
  private readonly fileSaver = inject(FileSaver);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly copyId = inject(CopyId);

  protected readonly displayedColumns = DISPLAYED_COLUMNS;
  protected readonly checkboxFilterFields = CHECKBOX_FILTER_FIELDS;
  protected readonly exportFormats = STANDARD_BOM_EXPORT_FORMATS;
  protected readonly exporting = signal(false);

  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  private readonly checkboxFilters = signal<CheckboxFilterSelections>(NO_CHECKBOX_FILTERS);
  protected readonly sortBy = signal<AppStandardBomReportSortBy>('productName');
  protected readonly sortDir = signal<AppStandardBomReportSortDir>('asc');

  private readonly filters = computed<AppStandardBomReportFilters>(() => {
    const f = this.checkboxFilters();
    return {
      brands: f.brands,
      activeStatuses: f.activeStatuses,
      productNames: f.productNames,
      componentNames: f.componentNames,
      miCodes: f.miCodes,
    };
  });

  /** How many values are chosen for a field; 0 while it has no filter. */
  protected selectedCount(key: CheckboxFilterKey): number {
    return this.checkboxFilters()[key]?.length ?? 0;
  }

  /** One chip per chosen value: «برند: کابلان» and «برند: لگراند», each removable on its own.
   * «فعال» reads بله/خیر. */
  protected readonly activeChips = computed<readonly ActiveFilterChip[]>(() =>
    multiValueFilterChips<CheckboxFilterKey, StandardBomFilterValue>(
      CHECKBOX_FILTER_FIELDS,
      this.checkboxFilters(),
      (_key, value) => (typeof value === 'boolean' ? this.formatActive(value) : value),
    ),
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
   * Only مدیریت and مدیر سیستم may register, edit or delete a standard BOM — a بازرس کنترل کیفیت
   * reads them but never writes them, unlike the daily BOMs it owns. `canManageStandardBoms` in
   * `core/identity/permissions.ts` is where that rule lives; the role comes from `GET /users/me`,
   * already resolved by `guardedRoute` before this page is constructed.
   *
   * It gates the affordances only, never the list: browsing is open to every authenticated user and
   * is served by `POST /standard-boms/report`, which carries no role restriction at all.
   */
  protected readonly canManage = computed(() => canManageStandardBoms(this.currentUser.role()));

  /**
   * The master data the create/edit form works from, not a second copy of the list.
   *
   * `standardBomsResource` is what an edit's starting values come from: a report row carries no
   * `productId` and no composition, and there is no `GET /standard-boms/:id` to fetch one with —
   * unlike the daily-BOM page, which has one and uses it. Standard BOMs are master data bounded by
   * the product catalogue, so holding them is cheap in a way holding every daily BOM would not be.
   *
   * `productsResource` is the product picker's own source — see `standard-bom-form-dialog.ts`.
   *
   * Both are fetched eagerly because the form opens from a click, not from a navigation, and would
   * otherwise have to wait — but only for a role that can open it at all. `params` returning
   * `undefined` is what leaves the resource idle: neither endpoint refuses a Reporter or a QC
   * Inspector, so nothing here would fail, it would simply be two requests for a form they will
   * never see.
   */
  protected readonly standardBomsResource = rxResource({
    params: () => (this.canManage() ? {} : undefined),
    stream: () => this.standardBomsGateway.list(),
    defaultValue: [] as AppStandardBom[],
  });

  protected readonly productsResource = rxResource({
    params: () => (this.canManage() ? {} : undefined),
    stream: () => this.productsGateway.list(),
    defaultValue: [] as AppProduct[],
  });

  protected readonly filterOptionsResource = rxResource({
    stream: () => this.gateway.filterOptions(),
    defaultValue: {
      brands: [],
      activeStatuses: [],
      productNames: [],
      componentNames: [],
      miCodes: [],
    } as AppStandardBomFilterOptions,
  });

  protected readonly reportResource = rxResource({
    params: () => {
      return {
        page: this.pageIndex() + 1,
        pageSize: this.pageSize(),
        filters: this.filters(),
        sortBy: this.sortBy(),
        sortDir: this.sortDir(),
      };
    },
    stream: ({ params }) => {
      this.refetchInFlight.set(true);
      return this.gateway
        .report(params.page, params.pageSize, params.filters, params.sortBy, params.sortDir)
        .pipe(finalize(() => this.refetchInFlight.set(false)));
    },
    defaultValue: { items: [], total: 0 } as AppStandardBomReportPage,
  });

  private readonly refetchInFlight = signal(false);

  protected readonly loading = computed(
    () => this.reportResource.isLoading() || this.refetchInFlight(),
  );
  protected readonly rows = computed<AppStandardBomReportRow[]>(
    () => this.reportResource.value().items,
  );
  protected readonly total = computed(() => this.reportResource.value().total);

  protected formatActive(active: boolean): string {
    return active ? 'بله' : 'خیر';
  }

  /** Exports the entire *filtered* result set — `this.filters()`, the same computed signal
   * `reportResource` consumes — never the currently rendered page: there is no page/pageSize
   * parameter on `StandardBomReportGateway#export` at all, by design, so nothing here narrows the
   * request to what happens to be on screen. Mirrors `BomsPage#onExport` exactly. */
  protected onExport(format: StandardBomExportFormat): void {
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

  protected onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  /**
   * Toggles the product-name sort direction between 'asc' and 'desc', resetting to the first
   * page so the new sort applies from the beginning of the dataset.
   */
  protected toggleProductNameSort(): void {
    this.sortDir.update((current) => (current === 'asc' ? 'desc' : 'asc'));
    this.pageIndex.set(0);
  }

  protected openFilterDialog(field: CheckboxFilterDescriptor): void {
    const options = this.filterOptionsResource.value();

    if (field.key === 'activeStatuses') {
      const data: StandardBomReportFilterDialogData<boolean> = {
        fieldLabel: field.label,
        options: toFilterOptions(options.activeStatuses, ACTIVE_LABELS),
        selectedValues: this.checkboxFilters().activeStatuses,
      };

      this.dialog
        .open<
          StandardBomReportFilterDialog<boolean>,
          StandardBomReportFilterDialogData<boolean>,
          StandardBomReportFilterDialogResult<boolean> | '' | undefined
        >(StandardBomReportFilterDialog<boolean>, { data })
        .afterClosed()
        .subscribe((result) => {
          if (!result) {
            return;
          }
          this.checkboxFilters.update((current) => ({
            ...current,
            activeStatuses: result.selected ? [...result.selected] : undefined,
          }));
          this.pageIndex.set(0);
        });
      return;
    }

    const data: StandardBomReportFilterDialogData<string> = {
      fieldLabel: field.label,
      options: toFilterOptions(options[field.key] as string[]),
      selectedValues: this.checkboxFilters()[field.key] as string[] | undefined,
    };

    this.dialog
      .open<
        StandardBomReportFilterDialog<string>,
        StandardBomReportFilterDialogData<string>,
        StandardBomReportFilterDialogResult<string> | '' | undefined
      >(StandardBomReportFilterDialog<string>, { data })
      .afterClosed()
      .subscribe((result) => {
        if (!result) {
          return;
        }
        this.checkboxFilters.update((current) => ({
          ...current,
          [field.key]: result.selected ? [...result.selected] : undefined,
        }));
        this.pageIndex.set(0);
      });
  }

  protected openDetailDialog(row: AppStandardBomReportRow): void {
    const data: StandardBomReportDetailDialogData = {
      id: row.id,
      miCode: row.miCode,
      canManage: this.canManage(),
    };
    this.dialog
      .open(StandardBomReportDetailDialog, { data })
      .afterClosed()
      .subscribe((result: StandardBomReportDetailDialogResult | '' | undefined) => {
        if (!result) {
          return;
        }
        if (result.action === 'edit') {
          this.onEditRow(row);
        } else {
          this.openDeleteDialog(row);
        }
      });
  }

  protected openCreateDialog(): void {
    this.dialog
      .open(StandardBomFormDialog, {
        data: { mode: 'create', products: this.productsResource.value() },
      })
      .afterClosed()
      .subscribe((registered) => {
        if (registered) {
          this.reloadAfterWrite();
        }
      });
  }

  /**
   * A report row is a projection — no `productId`, no composition — so the standard BOM the form
   * pre-fills from is looked up in `standardBomsResource` by id. A row with no match there means
   * that fetch failed or was refused; the snackbar says so rather than opening an empty form.
   */
  protected onEditRow(row: AppStandardBomReportRow): void {
    const standardBom = this.standardBomsResource
      .value()
      .find((candidate) => candidate.id === row.id);

    if (standardBom === undefined) {
      this.snackBar.open('آنالیز استاندارد برای ویرایش بارگذاری نشد.', 'باشه', { duration: 5000 });
      return;
    }

    this.dialog
      .open(StandardBomFormDialog, {
        data: { mode: 'edit', standardBom, products: this.productsResource.value() },
      })
      .afterClosed()
      .subscribe((edited) => {
        if (edited) {
          this.reloadAfterWrite();
        }
      });
  }

  protected openDeleteDialog(standardBom: ConfirmDeleteStandardBomTarget): void {
    this.dialog
      .open(ConfirmDeleteStandardBomDialog, {
        data: { standardBom: { id: standardBom.id, miCode: standardBom.miCode } },
      })
      .afterClosed()
      .subscribe((deleted) => {
        if (deleted) {
          this.reloadAfterWrite();
        }
      });
  }

  /** Both resources, not just the list: `standardBomsResource` is what the *next* edit pre-fills
   * from, so leaving it stale would reopen the form on the values the write just replaced. */
  private reloadAfterWrite(): void {
    this.reportResource.reload();
    this.standardBomsResource.reload();
  }
}
