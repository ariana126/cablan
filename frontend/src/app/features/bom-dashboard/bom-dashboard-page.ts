import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  Injector,
} from '@angular/core';
import { MediaMatcher } from '@angular/cdk/layout';
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

type Deviation = 'above' | 'below';

/**
 * "داشبورد بررسی روزانه آنالیز ها" (`bom-dashboard.feature`) — the read side of the daily-BOM
 * domain's dashboard view. Top-down layout: a date-range form (matches
 * `bom-reports-page.ts`'s identical "تاریخ و زمان ثبت" range control, so a visitor who knows one
 * page knows the other) on top, three equal stat tiles under it, the product list below them at
 * their combined width, and the per-product panel below *that* on selection. Stacking rather than
 * side-by-side keeps the RTL reading order natural and avoids a cramped two-pane at the widths a
 * Persian-language wide table already stretches to.
 *
 * **The three tiles are one size**: each counts something in the applied range — the daily BOMs
 * registered, the products analysed, and the newest registration — and the timestamp is set at the
 * same size as the two counts, so the row reads as one band. Each label says in full what it
 * counts and over what range, so no tile carries a separate note.
 *
 * **The product list is deliberately minimal**: only product name and a per-row daily-BOM count
 * come back from the API (`POST /api/boms/dashboard`), and the per-product daily-BOM list is
 * fetched **lazily on selection**. No product panel mounts until the visitor picks one, and
 * selecting a second product re-fetches rather than stacking. Picking a product scrolls the page to
 * its panel (smoothly, unless the visitor prefers reduced motion) and moves focus to the panel's
 * heading, so the detail they asked for is both on screen and announced.
 *
 * **Each daily BOM is one expansion panel**, identified by its tracking number (not its order
 * number): the header carries tracking number, order number, registration time and the
 * quality-control operator who registered it, the body the description and the per-line table.
 * The `/dashboard/:productId/daily-boms` response already nests `lines` inside each BOM, so no
 * client-side join is needed. Panels start open, so the numbers are on screen without a click.
 * The API sends the panels highest score first and they are rendered in that order; the score
 * itself is not shown.
 *
 * **Each line is shown against its standard**: the standard BOM's weight for the same material sits
 * beside the daily weight, followed by the difference the API computes — the absolute deviation
 * `|daily − standard|`, never negative, so a line 2 under standard and one 2 over both read ۲. The
 * direction is therefore derived here from the two weights (`deviationOf`) and shown by
 * `app-weight-difference`: an arrow and a colour pair (above standard red, below standard green),
 * followed by hidden words naming the direction, so colour never stands alone. A line exactly on
 * its standard — a difference of zero — leaves the cell empty.
 *
 * **The description belongs to the whole daily BOM**, so it sits once in the panel body above the
 * line table, never repeated on every line.
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
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly media = inject(MediaMatcher);

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

  /** The chosen product, or none once a new range no longer lists it. */
  protected readonly selectedProduct = computed<SelectedProduct | null>(() => {
    const selected = this.selected();
    if (selected === null || this.productListResource.isLoading()) {
      return selected;
    }
    return this.products().some((product) => product.productId === selected.productId)
      ? selected
      : null;
  });
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

  /** Only asked of a line with a non-zero difference; an exact match renders no pill at all. */
  protected deviationOf(line: AppBomDashboardDailyBomLine): Deviation {
    return line.actualWeight > line.standardWeight ? 'above' : 'below';
  }

  /** Set by a pick, cleared once the picked product's panel has been brought into view. */
  private readonly revealPending = signal(false);

  /**
   * Once the picked product's analyses have settled (loaded, empty or failed), bring the panel to
   * the top of the page and move focus to its heading, so the change is announced and a keyboard
   * user lands on the detail they asked for. It waits for the load because, while the panel only
   * holds its progress bar, the page below it can be too short to scroll it to the top. Focus does
   * not scroll on its own account: that would jump straight there and cut the smooth scroll short.
   */
  constructor() {
    effect(() => {
      if (!this.revealPending() || this.selectedProduct() === null || this.dailyBomsLoading()) {
        return;
      }
      this.revealPending.set(false);
      afterNextRender(() => this.revealPanel(), { injector: this.injector });
    });
  }

  private revealPanel(): void {
    const panel = this.host.nativeElement.querySelector<HTMLElement>('.panel');
    panel?.scrollIntoView({ behavior: this.scrollBehavior(), block: 'start' });
    panel?.querySelector<HTMLElement>('.panel__title')?.focus({ preventScroll: true });
  }

  protected selectProduct(product: AppBomDashboardProduct): void {
    this.selected.set({ productId: product.productId, productName: product.productName });
    this.revealPending.set(true);
  }

  private scrollBehavior(): ScrollBehavior {
    return this.media.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
  }

  protected closeSelectedProduct(): void {
    // The close button is about to be destroyed; give focus back to the product that opened it.
    const opener = this.host.nativeElement.querySelector<HTMLElement>(
      'button.row-pick[aria-pressed="true"]',
    );
    this.selected.set(null);
    this.revealPending.set(false);
    opener?.focus();
  }
}
