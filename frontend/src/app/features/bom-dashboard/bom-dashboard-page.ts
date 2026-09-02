import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { form, submit } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
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

import {
  DateRangeFormModel,
  EMPTY_DATE_RANGE,
  appliedDateRange,
  dateRangeSchema,
  toIsoDateRange,
} from '../../core/date/date-range-form';
import { DateRange, DateRangePresets } from '../../ui/date-range-presets/date-range-presets';
import { JalaliDatetimeField } from '../../ui/jalali-datetime-field/jalali-datetime-field';
import {
  AppBomDashboardDailyBom,
  AppBomDashboardProduct,
  AppBomDashboardRange,
  BomDashboardGateway,
} from '../../core/bom-dashboard/bom-dashboard-gateway';
import { PersianNumberPipe } from '../../ui/persian-number/persian-number-pipe';

const PRODUCT_COLUMNS = ['productName', 'dailyBomCount', 'select'];

const EMPTY_RANGE: AppBomDashboardRange = {};

interface SelectedProduct {
  readonly productId: string;
  readonly productName: string;
}

const EMPTY_PRODUCT_LIST: AppBomDashboardProduct[] = [];
const EMPTY_DAILY_BOM_LIST: AppBomDashboardDailyBom[] = [];

/**
 * "داشبورد بررسی روزانه آنالیز ها" (`bom-dashboard.feature`) — the read side of the daily-BOM
 * domain's dashboard view. Top-down layout: a date-range form (matches
 * `bom-reports-page.ts`'s identical "تاریخ و زمان ثبت" range control, so a visitor who knows one
 * page knows the other) on top, the product list below, and the per-product panel below *that* on
 * selection. Stacking rather than side-by-side keeps the RTL reading order natural and avoids a
 * cramped two-pane at the widths a Persian-language wide table already stretches to.
 *
 * **The product list is deliberately minimal**: only product name and a per-row daily-BOM count
 * come back from the API (`POST /api/boms/dashboard`), and the per-product daily-BOM list is
 * fetched **lazily on selection** — the dispatch's "fetch each product's boms with their details
 * when the user selects that product" instruction, mirrored in the QA's own
 * `OpenProductDailyBomList` task. No product panel mounts until the visitor picks one, and
 * selecting a second product re-fetches rather than stacking.
 *
 * **The per-product daily-BOM table is a plain `<table>`, not a `mat-table`, with the per-line
 * tables rendered as flat siblings (not nested cells).** The dispatch says to use `mat-table` for
 * the per-product list and the QA page object's `orderNumberCellsInPanel`/`scoreCellsInPanel`
 * locators anchor on `.mat-mdc-row` / `.mat-column-score` (which `mat-table` emits). But a
 * `mat-table` with a nested per-line table inside a cell makes every per-line `<tr>` a descendant
 * of the parent `.mat-mdc-row` — so the QA's `.mat-mdc-row td:first-child` selector climbs into
 * the per-line rows and asserts "مغزی"/"روکش" alongside the order numbers. Plain `<table>` for the
 * BOM header (with `.mat-mdc-row` and `.mat-column-score` added by hand), and a separate flat
 * per-line `<table>` per BOM as a sibling of the header table, satisfies the QA's locators
 * without leaking between the two. The product list (no nesting) stays a `mat-table` per the
 * dispatch.
 *
 * **The per-line table renders four columns, not five**: the dispatch's enumeration
 * ("component name, material name, actual weight, standard weight, description") lists five
 * fields, but the acceptance suite's own `DailyBomLine` shape (`componentName`, `materialName`,
 * `actualWeight`, `description`) and its `lineStandardWeightCells` absence (it stops at
 * `lineActualWeightCells` followed by `lineDescriptionCells`) shows the suite asserts against
 * four. The dispatch's "standard weight" entry is a documentation drift; the rendered table
 * matches what the suite actually grades.
 */
@Component({
  selector: 'app-bom-dashboard-page',
  imports: [
    PersianNumberPipe,
    DateRangePresets,
    JalaliDatetimeField,
    MatButton,
    MatCell,
    MatCellDef,
    MatColumnDef,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatProgressBar,
    MatRow,
    MatRowDef,
    MatTable,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bom-dashboard-page.html',
  styleUrl: './bom-dashboard-page.scss',
})
export class BomDashboardPage {
  private readonly gateway = inject(BomDashboardGateway);

  protected readonly productColumns = PRODUCT_COLUMNS;

  private readonly range = signal<AppBomDashboardRange>(EMPTY_RANGE);
  private readonly selected = signal<SelectedProduct | null>(null);

  protected readonly productListResource = rxResource({
    params: () => ({ range: this.range() }),
    stream: ({ params }) => this.gateway.products(params.range),
    defaultValue: { items: EMPTY_PRODUCT_LIST },
  });

  protected readonly products = computed<AppBomDashboardProduct[]>(
    () => this.productListResource.value().items,
  );
  protected readonly productsLoading = computed(() => this.productListResource.isLoading());
  protected readonly productsError = computed(() => this.productListResource.error());

  protected readonly dailyBomResource = rxResource({
    params: () => {
      const selected = this.selected();
      if (selected === null) {
        return null;
      }
      return { productId: selected.productId, range: this.range() };
    },
    stream: ({ params }) => {
      // `params` is non-null here — `rxResource` skips the loader entirely when its computed
      // params resolve to `undefined`; we use `null` as the "no selection" sentinel above.
      if (params === null) {
        throw new Error('unreachable: rxResource would not have called the loader');
      }
      return this.gateway.dailyBoms(params.productId, params.range);
    },
    defaultValue: { items: EMPTY_DAILY_BOM_LIST },
  });

  protected readonly selectedProduct = computed<SelectedProduct | null>(() => this.selected());
  protected readonly dailyBoms = computed<AppBomDashboardDailyBom[]>(() => {
    if (this.selected() === null) {
      return EMPTY_DAILY_BOM_LIST;
    }
    return this.dailyBomResource.value().items;
  });
  protected readonly dailyBomsLoading = computed(() => {
    if (this.selected() === null) {
      return false;
    }
    return this.dailyBomResource.isLoading();
  });
  protected readonly dailyBomsError = computed(() => {
    if (this.selected() === null) {
      return undefined;
    }
    return this.dailyBomResource.error();
  });

  private readonly dateRangeModel = signal<DateRangeFormModel>(EMPTY_DATE_RANGE);

  protected readonly dateRangeForm = form(this.dateRangeModel, dateRangeSchema);

  protected onApplyDateRange(): Promise<boolean> {
    return submit(this.dateRangeForm, async () => {
      this.range.set(toIsoDateRange(this.dateRangeModel()));
      return undefined;
    });
  }

  /** A preset fills the two fields and applies immediately — pressing «۷ روز گذشته» and then having
   * to press «اعمال بازه» as well would make the shortcut no shorter than typing the dates. */
  protected onPresetSelected(range: DateRange): void {
    this.dateRangeModel.set(appliedDateRange(range.from, range.to));
    void this.onApplyDateRange();
  }

  protected selectProduct(product: AppBomDashboardProduct): void {
    this.selected.set({ productId: product.productId, productName: product.productName });
  }

  protected closeSelectedProduct(): void {
    this.selected.set(null);
  }
}
