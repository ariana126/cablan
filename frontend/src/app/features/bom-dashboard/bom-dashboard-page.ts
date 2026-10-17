import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { form, submit } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import {
  MatExpansionPanel,
  MatExpansionPanelHeader,
  MatExpansionPanelTitle,
} from '@angular/material/expansion';
import { MatIcon } from '@angular/material/icon';
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
import { formatJalaliDateTime } from '../../core/date/jalali-datetime';
import { DataSheet } from '../../ui/data-sheet/data-sheet';
import { DateRange, DateRangePresets } from '../../ui/date-range-presets/date-range-presets';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { JalaliDatetimeField } from '../../ui/jalali-datetime-field/jalali-datetime-field';
import { PageHeader } from '../../ui/page-header/page-header';
import { StatTile } from '../../ui/stat-tile/stat-tile';
import { WeightDifference } from '../../ui/weight-difference/weight-difference';
import {
  AppBomDashboardDailyBom,
  AppBomDashboardDailyBomLine,
  AppBomDashboardProduct,
  AppBomDashboardRange,
  BomDashboardGateway,
} from '../../core/bom-dashboard/bom-dashboard-gateway';
import { PersianNumberPipe } from '../../ui/persian-number/persian-number-pipe';

const PRODUCT_COLUMNS = ['productName', 'dailyBomCount'];
const LINE_COLUMNS = [
  'componentName',
  'materialName',
  'standardWeight',
  'actualWeight',
  'difference',
];

const EMPTY_RANGE: AppBomDashboardRange = {};

interface SelectedProduct {
  readonly productId: string;
  readonly productName: string;
}

const EMPTY_PRODUCT_LIST: AppBomDashboardProduct[] = [];
const EMPTY_DAILY_BOM_LIST: AppBomDashboardDailyBom[] = [];

type Deviation = 'above' | 'below' | 'equal';

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
 * **Each daily BOM is one card**, identified by its tracking number (not its order number), so its
 * tracking number and score sit with its own per-line breakdown instead of in a separate list. The
 * `/dashboard/:productId/daily-boms` response already nests `lines` inside each BOM, so no
 * client-side join is needed. Inside a card the header is a one-row plain `<table>` (carrying
 * `.mat-mdc-row`, `.mat-column-trackingNumber` and `.mat-column-score` by hand, which the suite's
 * locators anchor on) and the per-line table is its sibling, never nested in a cell, so
 * `.mat-mdc-row td:first-child` cannot climb into line rows.
 *
 * **Each line is shown against its standard**: the standard BOM's weight for the same material sits
 * beside the daily weight, followed by the difference the API computes — the absolute deviation
 * `|daily − standard|`, never negative, so a line 2 under standard and one 2 over both read ۲. The
 * direction is therefore derived here from the two weights (`deviationOf`): above standard gets a
 * success-coloured outline, below it the error tint, an exact match nothing (see the `.difference`
 * rules in the stylesheet). Outline versus fill differ in shape, not only hue, and each deviating
 * cell is `aria-describedby` a hidden «بیشتر/کمتر از استاندارد», so colour never stands alone.
 *
 * **The description belongs to the whole daily BOM**, so it sits once in the card's header table
 * beside the tracking number and score, never repeated on every line.
 */
@Component({
  selector: 'app-bom-dashboard-page',
  imports: [
    DataSheet,
    DateRangePresets,
    EmptyState,
    ErrorBanner,
    JalaliDatetimeField,
    MatButton,
    MatCell,
    MatCellDef,
    MatColumnDef,
    MatExpansionPanel,
    MatExpansionPanelHeader,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatIcon,
    MatExpansionPanelTitle,
    MatProgressBar,
    MatRow,
    MatRowDef,
    MatTable,
    PageHeader,
    PersianNumberPipe,
    StatTile,
    WeightDifference,
  ],

  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bom-dashboard-page.html',
  styleUrl: './bom-dashboard-page.scss',
})
export class BomDashboardPage {
  private readonly gateway = inject(BomDashboardGateway);

  protected readonly productColumns = PRODUCT_COLUMNS;
  protected readonly lineColumns = LINE_COLUMNS;

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

  /** Every daily BOM in the range, summed over the products. */
  protected readonly totalAnalyses = computed(() =>
    this.products().reduce((sum, product) => sum + product.dailyBomCount, 0),
  );

  /** The newest registration anywhere in the range, as Jalali text; a dash when there is none. */
  protected readonly lastRegistered = computed(() => {
    const newest = this.products()
      .map((product) => new Date(product.lastRegisteredAt))
      .filter((date) => !Number.isNaN(date.getTime()))
      .reduce<Date | undefined>(
        (latest, date) => (latest === undefined || date > latest ? date : latest),
        undefined,
      );
    return newest === undefined ? '—' : formatJalaliDateTime(newest);
  });

  protected formatRegisteredAt(iso: string): string {
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? '—' : formatJalaliDateTime(parsed);
  }

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

  protected deviationOf(line: AppBomDashboardDailyBomLine): Deviation {
    if (line.actualWeight > line.standardWeight) {
      return 'above';
    }
    return line.actualWeight < line.standardWeight ? 'below' : 'equal';
  }

  protected selectProduct(product: AppBomDashboardProduct): void {
    this.selected.set({ productId: product.productId, productName: product.productName });
  }

  protected closeSelectedProduct(): void {
    this.selected.set(null);
  }
}
