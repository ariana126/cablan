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
import { MatDialog } from '@angular/material/dialog';
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
import {
  CheckboxFilterDialog,
  CheckboxFilterDialogData,
  CheckboxFilterDialogOption,
  CheckboxFilterDialogResult,
} from '../../ui/checkbox-filter-dialog/checkbox-filter-dialog';
import { FilterButton } from '../../ui/filter-button/filter-button';
import { CurrentUserStore } from '../../core/identity/current-user-store';
import { canApproveBoms } from '../../core/identity/permissions';
import {
  AppBomDashboardDailyBom,
  AppBomDashboardProduct,
  AppBomDashboardRange,
  BomDashboardGateway,
} from '../../core/bom-dashboard/bom-dashboard-gateway';
import { AppBomReportFilterOptions, BomReportGateway } from '../../core/boms/bom-report-gateway';
import { PersianNumberPipe } from '../../ui/persian-number/persian-number-pipe';
import { DailyBomCard } from './daily-bom-card';
import {
  approvalStatusFilterOptions,
  reviewerFilterOptions,
  DEFAULT_DASHBOARD_APPROVAL_FILTERS,
  DashboardApprovalFilters,
  withReviewers,
} from './approval-filters';

const PRODUCT_COLUMNS = ['productName', 'dailyBomCount'];

/** The dashboard's two Excel-style filters, keyed as `DashboardApprovalFilters` shapes them. */
type ApprovalFilterKey = keyof DashboardApprovalFilters;

const APPROVAL_FILTER_FIELDS: readonly {
  key: ApprovalFilterKey;
  label: string;
  options: (options: AppBomReportFilterOptions) => CheckboxFilterDialogOption[];
}[] = [
  { key: 'approvalStatuses', label: 'وضعیت تایید', options: approvalStatusFilterOptions },
  { key: 'reviewers', label: 'تایید/رد کننده', options: reviewerFilterOptions },
];

const NO_APPROVAL_FILTERS: DashboardApprovalFilters = {};

const NO_FILTER_OPTIONS: AppBomReportFilterOptions = {
  orderNumbers: [],
  trackingNumbers: [],
  brands: [],
  componentNames: [],
  standardBomMiCodes: [],
  productNames: [],
  registeredByUsers: [],
  approvalStatuses: [],
  reviewers: [],
};

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
 * **Each daily BOM is one `app-daily-bom-card`**, identified by its order number: see that
 * component for what a card shows and for the approve / reject / weight-correction actions it offers
 * Management and System Admin. The API sends the cards highest score first and they are rendered in
 * that order; the score itself is not shown.
 *
 * **«وضعیت تایید» and «تایید/رد کننده» filter the whole dashboard, server-side** — Excel-style, with the
 * same filter buttons and checkbox dialog as the daily-BOM report, in a «فیلتر تایید» group beside
 * the date range. They narrow the product list (its counts and newest registration included) and a
 * selected product's analyses alike, so both requests carry them; their values come from the
 * report's own `filter-options`. A dialog's «اعمال» applies at once — no «اعمال بازه» needed. A
 * product the filters (or the range) leave out of the list closes its panel for good rather than
 * springing back when it returns.
 *
 * **«وضعیت تایید» opens on «در انتظار تایید»** (`DEFAULT_DASHBOARD_APPROVAL_FILTERS`) — the dashboard is
 * where daily BOMs get reviewed, so it starts on the ones still waiting. The default is an ordinary
 * filter value: sent with both requests, ticked in the dialog, counted on the button, and it makes
 * an empty list offer «پاک کردن فیلترها», which lifts every approval filter, the default included.
 * It lives in this component, not a service, the URL or storage, so every visit starts on it again.
 * The daily-BOM report has no such default.
 *
 * **A card's write re-reads both lists rather than patching them** (the card's `changed`), since only
 * the API knows the new review and score — and whether the filters still let the daily BOM, or
 * its product, through: under «در انتظار تایید» a review takes the card off the panel, and the product
 * off the list once nothing pending is left. While the re-reads are out the product list and
 * cards stay on screen, the cards under a slim progress bar, so the page does not jump. If what had
 * focus was dropped, focus goes to the panel's heading, else the first product, else «پاک کردن
 * فیلترها».
 */
@Component({
  selector: 'app-bom-dashboard-page',
  imports: [
    DataSheet,
    DateRangePresets,
    EmptyState,
    ErrorBanner,
    JalaliDatetimeField,
    DailyBomCard,
    FilterButton,
    MatButton,
    MatCell,
    MatCellDef,
    MatColumnDef,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatIcon,
    MatProgressBar,
    MatRow,
    MatRowDef,
    MatTable,
    PageHeader,
    PersianNumberPipe,
    StatTile,
  ],

  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bom-dashboard-page.html',
  styleUrl: './bom-dashboard-page.scss',
})
export class BomDashboardPage {
  private readonly gateway = inject(BomDashboardGateway);
  private readonly reportGateway = inject(BomReportGateway);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly media = inject(MediaMatcher);
  private readonly dialog = inject(MatDialog);
  private readonly currentUser = inject(CurrentUserStore);

  protected readonly productColumns = PRODUCT_COLUMNS;
  protected readonly approvalFilterFields = APPROVAL_FILTER_FIELDS;

  /** Management and System Admin review daily BOMs here: approve, reject, correct a weight. */
  protected readonly canApprove = computed(() => canApproveBoms(this.currentUser.role()));

  private readonly range = signal<AppBomDashboardRange>(EMPTY_RANGE);
  // Held by the page, not a service or the URL, so every visit starts again on «در انتظار تایید».
  private readonly approvalFilters = signal<DashboardApprovalFilters>(
    DEFAULT_DASHBOARD_APPROVAL_FILTERS,
  );
  /** Whether the visitor has applied «وضعیت تایید» themselves on this visit — until then its
   * default gives way to a reviewer filter (`withReviewers`). */
  private readonly statusesChosen = signal(false);
  private readonly selected = signal<SelectedProduct | null>(null);

  /** The range and the approval filters as one request body — both lists are narrowed by it. */
  private readonly filters = computed(() => ({ ...this.range(), ...this.approvalFilters() }));

  protected readonly productListResource = rxResource({
    params: () => ({ filters: this.filters() }),
    stream: ({ params }) => this.gateway.products(params.filters),
    defaultValue: { items: EMPTY_PRODUCT_LIST },
  });

  protected readonly products = computed<AppBomDashboardProduct[]>(
    () => this.productListResource.value().items,
  );
  /** A first load for the range or filters; a re-read after a card's write keeps the list up. */
  protected readonly productsLoading = computed(
    () => this.productListResource.status() === 'loading',
  );
  protected readonly productsError = computed(() => this.productListResource.error());

  protected readonly dailyBomResource = rxResource({
    params: () => {
      const selected = this.selected();
      if (selected === null) {
        return null;
      }
      return { productId: selected.productId, filters: this.filters() };
    },
    stream: ({ params }) => {
      // `params` is non-null here — `rxResource` skips the loader entirely when its computed
      // params resolve to `undefined`; we use `null` as the "no selection" sentinel above.
      if (params === null) {
        throw new Error('unreachable: rxResource would not have called the loader');
      }
      return this.gateway.dailyBoms(params.productId, params.filters);
    },
    defaultValue: { items: EMPTY_DAILY_BOM_LIST },
  });

  /** The chosen product, or none once the list no longer has it (see the constructor). */
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
  /** A first load for the picked product (or range): nothing to show until it answers. */
  protected readonly dailyBomsLoading = computed(() => {
    if (this.selected() === null) {
      return false;
    }
    return this.dailyBomResource.status() === 'loading';
  });
  /** A re-read after a card's write: the cards stay on screen meanwhile. */
  protected readonly dailyBomsReloading = computed(
    () => this.selected() !== null && this.dailyBomResource.status() === 'reloading',
  );

  protected readonly filterOptionsResource = rxResource({
    stream: () => this.reportGateway.filterOptions(),
    defaultValue: NO_FILTER_OPTIONS,
  });

  protected readonly hasApprovalFilters = computed(() =>
    Object.values(this.approvalFilters()).some((values) => values !== undefined),
  );

  /** How many values are chosen for an approval filter; 0 while it has none. */
  protected approvalFilterCount(key: ApprovalFilterKey): number {
    return this.approvalFilters()[key]?.length ?? 0;
  }

  protected openApprovalFilter(field: (typeof APPROVAL_FILTER_FIELDS)[number]): void {
    const data: CheckboxFilterDialogData = {
      fieldLabel: field.label,
      options: field.options(this.filterOptionsResource.value()),
      selectedValues: this.approvalFilters()[field.key],
    };
    this.dialog
      .open(CheckboxFilterDialog, { data })
      .afterClosed()
      .subscribe((result: CheckboxFilterDialogResult | '' | undefined) => {
        if (!result) {
          return;
        }
        if (field.key === 'reviewers') {
          this.approvalFilters.update((current) =>
            withReviewers(current, result.selected, this.statusesChosen()),
          );
          return;
        }
        this.statusesChosen.set(true);
        this.approvalFilters.update((current) => ({ ...current, [field.key]: result.selected }));
      });
  }

  /** Lifts every approval filter, the default «در انتظار تایید» included: the visitor asked for all. */
  protected clearApprovalFilters(): void {
    this.approvalFilters.set(NO_APPROVAL_FILTERS);
  }

  /** Set by a card's write, cleared once both re-reads have settled (see the constructor). */
  private readonly refocusPending = signal(false);

  /**
   * A write can change what the filters let through — a review under «در انتظار تایید» takes the
   * daily BOM off the dashboard, and its product too once nothing pending is left — so both
   * lists are re-read, not just the panel's.
   */
  protected onDailyBomChanged(): void {
    this.refocusPending.set(true);
    this.productListResource.reload();
    this.dailyBomResource.reload();
  }
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
   * to press «اعمال بازه» as well would make the shortcut no shorter than picking the dates. */
  protected onPresetSelected(range: DateRange): void {
    this.dateRangeModel.set(appliedDateRange(range.from, range.to));
    void this.onApplyDateRange();
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
    // A product the new range or filters leave out is let go of, so its panel stays closed even if
    // a later change brings the product back — the visitor picks it again if they still want it.
    effect(() => {
      const selected = this.selected();
      if (selected === null || this.productListResource.status() !== 'resolved') {
        return;
      }
      if (!this.products().some((product) => product.productId === selected.productId)) {
        this.selected.set(null);
        this.revealPending.set(false);
      }
    });

    // Once a write's re-reads have settled, a card or panel the filters dropped may have taken focus
    // with it; give it to the nearest thing still standing.
    effect(() => {
      if (
        !this.refocusPending() ||
        this.productListResource.isLoading() ||
        this.dailyBomsLoading() ||
        this.dailyBomsReloading()
      ) {
        return;
      }
      this.refocusPending.set(false);
      afterNextRender(() => this.restoreLostFocus(), { injector: this.injector });
    });

    effect(() => {
      if (!this.revealPending() || this.selectedProduct() === null || this.dailyBomsLoading()) {
        return;
      }
      this.revealPending.set(false);
      afterNextRender(() => this.revealPanel(), { injector: this.injector });
    });
  }

  /**
   * Only when focus was actually lost — a card that stays focuses its own swapped button. The panel's
   * heading if the panel is still open, else the first product left, else «پاک کردن فیلترها».
   */
  private restoreLostFocus(): void {
    const active = document.activeElement;
    if (active !== null && active !== document.body && active.isConnected) {
      return;
    }
    const host = this.host.nativeElement;
    const target =
      host.querySelector<HTMLElement>('.panel__title') ??
      host.querySelector<HTMLElement>('button.row-pick') ??
      host.querySelector<HTMLElement>('app-empty-state button');
    target?.focus();
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
