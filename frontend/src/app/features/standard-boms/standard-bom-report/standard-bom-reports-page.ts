import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
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

import {
  AppStandardBomFilterOptions,
  AppStandardBomReportFilters,
  AppStandardBomReportPage,
  AppStandardBomReportRow,
  AppStandardBomReportSortBy,
  AppStandardBomReportSortDir,
  StandardBomReportGateway,
} from '../../../core/standard-boms/standard-bom-report-gateway';
import { AuthGateway } from '../../../core/identity/auth-gateway';
import {
  StandardBomReportDetailDialog,
  StandardBomReportDetailDialogData,
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

/** The four Excel-style checkbox filters, keyed exactly as `AppStandardBomReportFilters` shapes them. */
type CheckboxFilterKey = 'brands' | 'activeStatuses' | 'productNames' | 'componentNames';

interface CheckboxFilterDescriptor {
  readonly key: CheckboxFilterKey;
  readonly label: string;
}

const CHECKBOX_FILTER_FIELDS: readonly CheckboxFilterDescriptor[] = [
  { key: 'brands', label: 'برند' },
  { key: 'activeStatuses', label: 'فعال' },
  { key: 'productNames', label: 'نام محصول' },
  { key: 'componentNames', label: 'نام جز' },
];

/** Per-field selections: `activeStatuses` holds booleans, the rest hold strings. */
interface CheckboxFilterSelections {
  brands: string[] | undefined;
  activeStatuses: boolean[] | undefined;
  productNames: string[] | undefined;
  componentNames: string[] | undefined;
}

const NO_CHECKBOX_FILTERS: CheckboxFilterSelections = {
  brands: undefined,
  activeStatuses: undefined,
  productNames: undefined,
  componentNames: undefined,
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
 * "گزارش آنالیز های استاندارد" — the گزارشگیر (Reporter) role's own read side of the standard BOM
 * domain. Mirrors `bom-reports-page.ts`: any authenticated user may browse, paginates and
 * filters entirely server-side through `POST /standard-boms/report`, and never fetches or holds
 * the full dataset — the paginator's `length` is the response's own `total`, not this page's row
 * count.
 *
 * **The list view intentionally does NOT show standardLength, description, components, materials or
 * total weight** — those are only in the detail dialog (`standard-bom-report-detail-dialog.ts`),
 * reached through the "جزئیات" button in the "عملیات" column.
 *
 * **Filterable fields do not mirror the list's columns 1:1, on purpose**: "نام جز" is filterable
 * but never a column (components only ever appear in the detail dialog), and "کد MI" is a column
 * with no filter (`filter-options` returns no distinct-value set for it).
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
 * **An "عملیات" column carries the "جزئیات" button** — a table with a per-row action needs some
 * accessible way to trigger it that isn't a `div` click target or an ARIA role forced onto a
 * table row.
 */
@Component({
  selector: 'app-standard-bom-reports-page',
  imports: [
    MatButton,
    MatCell,
    MatCellDef,
    MatColumnDef,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
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
        <h1>گزارش آنالیز های استاندارد</h1>
        <button matButton type="button" (click)="logout()">خروج از سیستم</button>
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
          aria-label="در حال بارگذاری گزارش آنالیز های استاندارد"
        />
      } @else if (reportResource.error()) {
        <div class="stack--tight">
          <p role="alert" class="form-error">گزارش آنالیز های استاندارد بارگذاری نشد.</p>
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
  styleUrl: './standard-bom-reports-page.scss',
})
export class StandardBomReportsPage {
  private readonly gateway = inject(StandardBomReportGateway);
  private readonly authGateway = inject(AuthGateway);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  protected readonly displayedColumns = DISPLAYED_COLUMNS;
  protected readonly checkboxFilterFields = CHECKBOX_FILTER_FIELDS;

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
    };
  });

  protected readonly filterOptionsResource = rxResource({
    stream: () => this.gateway.filterOptions(),
    defaultValue: {
      brands: [],
      activeStatuses: [],
      productNames: [],
      componentNames: [],
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
    const data: StandardBomReportDetailDialogData = { id: row.id, miCode: row.miCode };
    this.dialog.open(StandardBomReportDetailDialog, { data });
  }

  protected logout(): void {
    this.authGateway.logout();
    this.router.navigateByUrl('/login');
  }
}
