import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatProgressBar } from '@angular/material/progress-bar';
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
import { Router } from '@angular/router';

import {
  AppStandardBomFilterOptions,
  AppStandardBomReportFilters,
  AppStandardBomReportPage,
  AppStandardBomReportRow,
  AppStandardBomReportSortBy,
  AppStandardBomReportSortDir,
  StandardBomReportGateway,
} from '../../core/standard-boms/standard-bom-report-gateway';
import { XlsxDownloader } from '../../core/files/xlsx-downloader';
import { AuthGateway } from '../../core/identity/auth-gateway';
import { AppProduct, ProductsGateway } from '../../core/products/products-gateway';
import {
  AppStandardBom,
  StandardBomsGateway,
} from '../../core/standard-boms/standard-boms-gateway';
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
  STANDARD_BOM_EXPORT_FILE_NAME,
  STANDARD_BOM_EXPORT_FORMATS,
  StandardBomExportFormatKey,
  buildStandardBomExportGrid,
} from './standard-bom-report-export';
import {
  StandardBomFilterOption,
  StandardBomFilterValue,
  StandardBomReportFilterDialog,
  StandardBomReportFilterDialogData,
  StandardBomReportFilterDialogResult,
} from './standard-bom-report-filter-dialog';

const DISPLAYED_COLUMNS = ['miCode', 'productName', 'brand', 'active', 'actions'];

const DEFAULT_PAGE_SIZE = 20;

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

const ACTIVE_LABELS = new Map<boolean, string>([
  [true, 'بله'],
  [false, 'خیر'],
]);

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
    MatButton,
    MatCell,
    MatCellDef,
    MatColumnDef,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatPaginator,
    MatProgressBar,
    MatRow,
    MatRowDef,
    MatTable,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack">
      <div class="header">
        <h1>آنالیز های استاندارد</h1>
        <div class="header-actions">
          @if (canManage()) {
            <button matButton="filled" type="button" (click)="openCreateDialog()">
              افزودن آنالیز استاندارد
            </button>
          }
          <button
            matButton="outlined"
            type="button"
            [matMenuTriggerFor]="exportMenu"
            [disabled]="exporting()"
          >
            خروجی اکسل
          </button>
          <mat-menu #exportMenu="matMenu">
            @for (format of exportFormats; track format.key) {
              <button mat-menu-item type="button" (click)="onExport(format.key)">
                {{ format.label }}
              </button>
            }
          </mat-menu>
          <button matButton type="button" (click)="logout()">خروج از سیستم</button>
        </div>
      </div>

      <div class="filter-toolbar" role="group" aria-label="فیلترهای گزارش">
        @for (field of checkboxFilterFields; track field.key) {
          <button
            matButton="outlined"
            type="button"
            [disabled]="filterOptionsResource.isLoading()"
            (click)="openFilterDialog(field)"
          >
            فیلتر {{ field.label }}
          </button>
        }
      </div>

      @if (loading()) {
        <mat-progress-bar
          mode="indeterminate"
          aria-label="در حال بارگذاری فهرست آنالیز های استاندارد"
        />
      } @else if (reportResource.error()) {
        <div class="stack--tight">
          <p role="alert" class="form-error">فهرست آنالیز های استاندارد بارگذاری نشد.</p>
          <button matButton type="button" (click)="reportResource.reload()">تلاش دوباره</button>
        </div>
      } @else if (rows().length === 0) {
        <p>هیچ آنالیز استانداردی یافت نشد.</p>
      } @else {
        <div class="table-scroll">
          <table mat-table [dataSource]="rows()">
            <ng-container matColumnDef="miCode">
              <th mat-header-cell *matHeaderCellDef>کد MI</th>
              <td mat-cell *matCellDef="let row">{{ row.miCode }}</td>
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

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>عملیات</th>
              <td mat-cell *matCellDef="let row">
                <button
                  matButton
                  type="button"
                  [attr.aria-label]="'جزئیات ' + row.miCode"
                  (click)="openDetailDialog(row)"
                >
                  جزئیات
                </button>
                @if (canManage()) {
                  <button
                    matButton
                    type="button"
                    [attr.aria-label]="'ویرایش ' + row.miCode"
                    (click)="onEditRow(row)"
                  >
                    ویرایش
                  </button>
                  <button
                    matButton
                    type="button"
                    [attr.aria-label]="'حذف ' + row.miCode"
                    (click)="openDeleteDialog(row)"
                  >
                    حذف
                  </button>
                }
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
          </table>
        </div>

        <mat-paginator
          [length]="total()"
          [pageIndex]="pageIndex()"
          [pageSize]="pageSize()"
          [pageSizeOptions]="[10, 20, 50]"
          (page)="onPage($event)"
        />
      }
    </div>
  `,
  styleUrl: './standard-boms-page.scss',
})
export class StandardBomsPage {
  private readonly gateway = inject(StandardBomReportGateway);
  private readonly standardBomsGateway = inject(StandardBomsGateway);
  private readonly productsGateway = inject(ProductsGateway);
  private readonly authGateway = inject(AuthGateway);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly xlsxDownloader = inject(XlsxDownloader);
  private readonly snackBar = inject(MatSnackBar);

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
   * otherwise have to wait.
   */
  protected readonly standardBomsResource = rxResource({
    stream: () => this.standardBomsGateway.list(),
    defaultValue: [] as AppStandardBom[],
  });

  protected readonly productsResource = rxResource({
    stream: () => this.productsGateway.list(),
    defaultValue: [] as AppProduct[],
  });

  /**
   * The API has no "who am I" endpoint, so the frontend cannot know the caller's role ahead of
   * time — a 403 from `GET /standard-boms` is what tells it the write actions would be refused.
   * It gates the affordances only, never the list: browsing is open to every authenticated user and
   * is served by `POST /standard-boms/report`, which carries no role restriction at all.
   */
  protected readonly canManage = computed(() => {
    const error = this.standardBomsResource.error();
    return !(error instanceof HttpErrorResponse && error.status === 403);
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
  protected onExport(format: StandardBomExportFormatKey): void {
    this.exporting.set(true);
    this.gateway.export(this.filters()).subscribe({
      next: (items) => {
        const grid = buildStandardBomExportGrid(items, format);
        void this.xlsxDownloader
          .download(grid, STANDARD_BOM_EXPORT_FILE_NAME)
          .finally(() => this.exporting.set(false));
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

  protected logout(): void {
    this.authGateway.logout();
    this.router.navigateByUrl('/login');
  }
}
