import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormField, submit, validate, form } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatProgressBar } from '@angular/material/progress-bar';
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

import { formatJalaliDateTime, parseJalaliDateTime } from '../../core/date/jalali-datetime';
import {
  AppBomReportFilterOptions,
  AppBomReportFilters,
  AppBomReportPage,
  AppBomReportRow,
  BomReportGateway,
} from '../../core/boms/bom-report-gateway';
import { AuthGateway } from '../../core/identity/auth-gateway';
import { BomReportDetailDialog, BomReportDetailDialogData } from './bom-report-detail-dialog';
import {
  BomReportFilterDialog,
  BomReportFilterDialogData,
  BomReportFilterDialogResult,
} from './bom-report-filter-dialog';

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

const JALALI_FORMAT_ERROR = {
  kind: 'invalidJalaliDateTime',
  message: 'قالب تاریخ و زمان معتبر نیست. نمونه: 1403/04/01 08:30',
};

/**
 * "مشاهده آنالیز روزانه" (`reporting-bom.feature`) — the گزارشگیر role's own read side of the daily
 * BOM domain. Carries no role restriction at all (any authenticated user may browse), paginates and
 * filters entirely server-side through `POST /boms/report`, and never fetches or holds the full
 * dataset — the paginator's `length` is the response's own `total`, not this page's row count.
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
 * **An eighth "عملیات" column carries the "جزئیات" button.** The feature's own "لیست فقط شامل ستون
 * های زیر باشد" rule enumerates the seven *business* columns this page must never leak
 * متراژ استاندارد/اجزا/مواد اولیه/توضیحات/جمع وزن مواد اولیه into — it does not forbid a UI
 * affordance column, and a table with a per-row action needs some accessible way to trigger it that
 * isn't a `div` click target or an ARIA role forced onto a table row.
 */
@Component({
  selector: 'app-bom-reports-page',
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
        <h1>گزارش آنالیز های روزانه</h1>
        <button matButton type="button" (click)="logout()">خروج از سیستم</button>
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
          aria-label="در حال بارگذاری گزارش آنالیز های روزانه"
        />
      } @else if (reportResource.error()) {
        <div class="stack--tight">
          <p role="alert" class="form-error">گزارش آنالیز های روزانه بارگذاری نشد.</p>
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
  styleUrl: './bom-reports-page.scss',
})
export class BomReportsPage {
  private readonly gateway = inject(BomReportGateway);
  private readonly authGateway = inject(AuthGateway);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  protected readonly displayedColumns = DISPLAYED_COLUMNS;
  protected readonly checkboxFilterFields = CHECKBOX_FILTER_FIELDS;

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
    const data: BomReportDetailDialogData = { id: row.id, orderNumber: row.orderNumber };
    this.dialog.open(BomReportDetailDialog, { data });
  }

  protected logout(): void {
    this.authGateway.logout();
    this.router.navigateByUrl('/login');
  }
}
