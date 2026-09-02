import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormField, submit, validate, form } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
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

import { formatJalaliDateTime, parseJalaliDateTime } from '../../core/date/jalali-datetime';
import {
  AppBomDetail,
  AppBomReportFilterOptions,
  AppBomReportFilters,
  AppBomReportPage,
  AppBomReportRow,
  BomReportGateway,
} from '../../core/boms/bom-report-gateway';
import { AppBom } from '../../core/boms/boms-gateway';
import { XlsxDownloader } from '../../core/files/xlsx-downloader';
import { CurrentUserStore } from '../../core/identity/current-user-store';
import { canManageBoms } from '../../core/identity/permissions';
import {
  AppStandardBom,
  StandardBomsGateway,
} from '../../core/standard-boms/standard-boms-gateway';
import { BomFormDialog } from './bom-form-dialog';
import {
  BomReportDetailDialog,
  BomReportDetailDialogData,
  BomReportDetailDialogResult,
} from './bom-report-detail-dialog';
import {
  BOM_EXPORT_FILE_NAME,
  BOM_EXPORT_FORMATS,
  BomExportFormatKey,
  buildBomExportGrid,
} from './bom-report-export';
import {
  BomReportFilterDialog,
  BomReportFilterDialogData,
  BomReportFilterDialogResult,
} from './bom-report-filter-dialog';
import { ConfirmDeleteBomDialog, ConfirmDeleteBomTarget } from './confirm-delete-bom-dialog';

const DISPLAYED_COLUMNS = [
  'orderNumber',
  'trackingNumber',
  'registeredAt',
  'registeredBy',
  'standardBomMiCode',
  'brand',
  'productName',
  'actions',
];

const DEFAULT_PAGE_SIZE = 20;

/** The five Excel-style checkbox filters, keyed exactly as `AppBomReportFilters`/`BomReportFiltersDto`
 * shape them. "تاریخ و زمان ثبت" is deliberately not one of them — see this file's own date-range
 * section for why. */
type CheckboxFilterKey =
  'brands' | 'componentNames' | 'standardBomMiCodes' | 'productNames' | 'registeredByUsers';

const CHECKBOX_FILTER_FIELDS: readonly { key: CheckboxFilterKey; label: string }[] = [
  { key: 'brands', label: 'برند' },
  { key: 'componentNames', label: 'نام جز' },
  { key: 'standardBomMiCodes', label: 'کد MI' },
  { key: 'productNames', label: 'نام محصول' },
  { key: 'registeredByUsers', label: 'کنترلگر' },
];

type CheckboxFilterSelections = Record<CheckboxFilterKey, string[] | undefined>;

const NO_CHECKBOX_FILTERS: CheckboxFilterSelections = {
  brands: undefined,
  componentNames: undefined,
  standardBomMiCodes: undefined,
  productNames: undefined,
  registeredByUsers: undefined,
};

interface DateRangeFormModel {
  readonly from: string;
  readonly to: string;
}

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

const JALALI_FORMAT_ERROR = {
  kind: 'invalidJalaliDateTime',
  message: 'قالب تاریخ و زمان معتبر نیست. نمونه: 1403/04/01 08:30',
};

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
 * never a column (components only ever appear in the detail dialog), and "شماره سفارش"/"شماره
 * ردیابی" are columns with no filter at all — the backend's `GET /boms/report/filter-options` simply
 * has no distinct-value set for either. The filter buttons below live in their own toolbar rather
 * than inside a column header for exactly that reason.
 *
 * **"تاریخ و زمان ثبت" gets a persistent range control, never an Excel-style checkbox panel** —
 * `filter-options` returns no distinct values for it, so there is nothing to build a checkbox list
 * from. It stays visible at all times (not behind its own "فیلتر" button) since applying it is a
 * single action, not a multi-value selection to build up.
 *
 * **An eighth "عملیات" column carries the "جزئیات", "ویرایش" and "حذف" buttons.** The feature's own
 * "لیست فقط شامل ستون های زیر باشد" rule enumerates the seven *business* columns this page must
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
    FormField,
    MatButton,
    MatCell,
    MatCellDef,
    MatColumnDef,
    MatError,
    MatFormField,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatInput,
    MatLabel,
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
        <h1>آنالیز های روزانه</h1>
        <div class="header-actions">
          @if (canManage()) {
            <button matButton="filled" type="button" (click)="openCreateDialog()">
              افزودن آنالیز روزانه
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
        </div>
      </div>

      <form novalidate class="date-range" (submit)="onApplyDateRange(); $event.preventDefault()">
        <mat-form-field appearance="outline">
          <mat-label>از تاریخ و زمان ثبت</mat-label>
          <input matInput [formField]="dateRangeForm.from" autocomplete="off" />
          @if (dateRangeForm.from().touched() && dateRangeForm.from().errors().length) {
            <mat-error>{{ dateRangeForm.from().errors()[0].message }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>تا تاریخ و زمان ثبت</mat-label>
          <input matInput [formField]="dateRangeForm.to" autocomplete="off" placeholder="اکنون" />
          @if (dateRangeForm.to().touched() && dateRangeForm.to().errors().length) {
            <mat-error>{{ dateRangeForm.to().errors()[0].message }}</mat-error>
          }
        </mat-form-field>

        <button matButton="outlined" type="submit">اعمال بازه</button>
      </form>

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
          aria-label="در حال بارگذاری فهرست آنالیز های روزانه"
        />
      } @else if (reportResource.error()) {
        <div class="stack--tight">
          <p role="alert" class="form-error">فهرست آنالیز های روزانه بارگذاری نشد.</p>
          <button matButton type="button" (click)="reportResource.reload()">تلاش دوباره</button>
        </div>
      } @else if (rows().length === 0) {
        <p>هیچ آنالیز روزانه‌ای یافت نشد.</p>
      } @else {
        <div class="table-scroll">
          <table mat-table [dataSource]="rows()">
            <ng-container matColumnDef="orderNumber">
              <th mat-header-cell *matHeaderCellDef>شماره سفارش</th>
              <td mat-cell *matCellDef="let row">{{ row.orderNumber }}</td>
            </ng-container>

            <ng-container matColumnDef="trackingNumber">
              <th mat-header-cell *matHeaderCellDef>شماره ردیابی</th>
              <td mat-cell *matCellDef="let row">{{ row.trackingNumber }}</td>
            </ng-container>

            <ng-container matColumnDef="registeredAt">
              <th mat-header-cell *matHeaderCellDef>تاریخ و زمان ثبت</th>
              <td mat-cell *matCellDef="let row">{{ formatRegisteredAt(row.registeredAt) }}</td>
            </ng-container>

            <ng-container matColumnDef="registeredBy">
              <th mat-header-cell *matHeaderCellDef>کنترلگر</th>
              <td mat-cell *matCellDef="let row">{{ row.registeredBy }}</td>
            </ng-container>

            <ng-container matColumnDef="standardBomMiCode">
              <th mat-header-cell *matHeaderCellDef>کد MI</th>
              <td mat-cell *matCellDef="let row">{{ row.standardBomMiCode }}</td>
            </ng-container>

            <ng-container matColumnDef="brand">
              <th mat-header-cell *matHeaderCellDef>برند</th>
              <td mat-cell *matCellDef="let row">{{ row.brand }}</td>
            </ng-container>

            <ng-container matColumnDef="productName">
              <th mat-header-cell *matHeaderCellDef>نام محصول</th>
              <td mat-cell *matCellDef="let row">{{ row.productName }}</td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>عملیات</th>
              <td mat-cell *matCellDef="let row">
                <button
                  matButton
                  type="button"
                  [attr.aria-label]="'جزئیات ' + row.orderNumber"
                  (click)="openDetailDialog(row)"
                >
                  جزئیات
                </button>
                @if (canManage()) {
                  <button
                    matButton
                    type="button"
                    [disabled]="openingEditFor() !== undefined"
                    [attr.aria-label]="'ویرایش ' + row.orderNumber"
                    (click)="onEditRow(row)"
                  >
                    ویرایش
                  </button>
                  <button
                    matButton
                    type="button"
                    [attr.aria-label]="'حذف ' + row.orderNumber"
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
  styleUrl: './boms-page.scss',
})
export class BomsPage {
  private readonly gateway = inject(BomReportGateway);
  private readonly standardBomsGateway = inject(StandardBomsGateway);
  private readonly currentUser = inject(CurrentUserStore);
  private readonly dialog = inject(MatDialog);
  private readonly xlsxDownloader = inject(XlsxDownloader);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly displayedColumns = DISPLAYED_COLUMNS;
  protected readonly checkboxFilterFields = CHECKBOX_FILTER_FIELDS;
  protected readonly exportFormats = BOM_EXPORT_FORMATS;
  protected readonly exporting = signal(false);

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

  private readonly filters = computed<AppBomReportFilters>(() => ({
    ...this.checkboxFilters(),
    ...this.dateRangeFilters(),
  }));

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

  protected readonly filterOptionsResource = rxResource({
    stream: () => this.gateway.filterOptions(),
    defaultValue: {
      brands: [],
      componentNames: [],
      standardBomMiCodes: [],
      productNames: [],
      registeredByUsers: [],
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

  private readonly dateRangeModel = signal<DateRangeFormModel>({ from: '', to: '' });

  protected readonly dateRangeForm = form(this.dateRangeModel, (path) => {
    validate(path.from, ({ value }) => {
      const text = value().trim();
      return text !== '' && parseJalaliDateTime(text) === undefined
        ? JALALI_FORMAT_ERROR
        : undefined;
    });
    validate(path.to, ({ value }) => {
      const text = value().trim();
      return text !== '' && parseJalaliDateTime(text) === undefined
        ? JALALI_FORMAT_ERROR
        : undefined;
    });
  });

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
      const { from, to } = this.dateRangeModel();
      const fromText = from.trim();
      const toText = to.trim();

      this.dateRangeFilters.set({
        registeredAtFrom:
          fromText === '' ? undefined : parseJalaliDateTime(fromText)!.toISOString(),
        registeredAtTo: toText === '' ? undefined : parseJalaliDateTime(toText)!.toISOString(),
      });
      this.pageIndex.set(0);
      return undefined;
    });
  }

  /** Exports the entire *filtered* result set — `this.filters()`, the same computed signal
   * `reportResource` consumes — never the currently rendered page: there is no page/pageSize
   * parameter on `BomReportGateway#export` at all, by design, so nothing here narrows the request to
   * what happens to be on screen. */
  protected onExport(format: BomExportFormatKey): void {
    this.exporting.set(true);
    this.gateway.export(this.filters()).subscribe({
      next: (items) => {
        const grid = buildBomExportGrid(items, format);
        void this.xlsxDownloader
          .download(grid, BOM_EXPORT_FILE_NAME)
          .finally(() => this.exporting.set(false));
      },
      error: () => {
        this.exporting.set(false);
        this.snackBar.open('خروجی اکسل گرفته نشد.', 'باشه', { duration: 5000 });
      },
    });
  }

  protected openFilterDialog(field: { key: CheckboxFilterKey; label: string }): void {
    const data: BomReportFilterDialogData = {
      fieldLabel: field.label,
      allValues: this.filterOptionsResource.value()[field.key],
      selectedValues: this.checkboxFilters()[field.key],
    };

    this.dialog
      .open(BomReportFilterDialog, { data })
      .afterClosed()
      .subscribe((result: BomReportFilterDialogResult | '' | undefined) => {
        if (!result) {
          return;
        }
        this.checkboxFilters.update((current) => ({ ...current, [field.key]: result.selected }));
        this.pageIndex.set(0);
      });
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
        data: { mode: 'create', standardBoms: this.standardBomsResource.value() },
      })
      .afterClosed()
      .subscribe((registered) => {
        if (registered) {
          this.reportResource.reload();
        }
      });
  }

  /**
   * A report row is a projection: it carries neither the composition nor the `standardBomId` the
   * form pre-fills from, so the whole daily BOM is fetched first. Only this one is — the page never
   * holds them all.
   */
  protected onEditRow(row: AppBomReportRow): void {
    this.openingEditFor.set(row.id);
    this.gateway.get(row.id).subscribe({
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
        data: { mode: 'edit', bom, standardBoms: this.standardBomsResource.value() },
      })
      .afterClosed()
      .subscribe((edited) => {
        if (edited) {
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
