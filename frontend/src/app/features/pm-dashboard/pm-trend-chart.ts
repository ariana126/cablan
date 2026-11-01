import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import {
  MatExpansionPanel,
  MatExpansionPanelHeader,
  MatExpansionPanelTitle,
} from '@angular/material/expansion';
import { MatIcon } from '@angular/material/icon';
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
import { MatTooltip } from '@angular/material/tooltip';

import { formatPersianNumber } from '../../core/i18n/persian-numerals';
import { AppPmDashboardTrendPoint } from '../../core/maintenance/pm-dashboard-gateway';
import { Icon } from '../../ui/icon/icon';
import { PersianNumberPipe } from '../../ui/persian-number/persian-number-pipe';
import { StackedTable } from '../../ui/stacked-table/stacked-table';
import { performancePercentLabel, trendRangeLabel } from './pm-dashboard-figures';

export type PmTrendGranularity = 'daily' | 'weekly';

/** A point placed on the plot: where along the time axis (0–1 from the start edge), and its data. */
interface PlacedPoint {
  readonly index: number;
  readonly position: number;
  readonly point: AppPmDashboardTrendPoint;
  readonly range: string;
  readonly summary: string;
}

/** The SVG's own coordinate space; it is stretched to the plot box, strokes kept 2px. */
const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 100;

const DISPLAYED_COLUMNS = ['range', 'considered', 'adherence', 'completion', 'actions'];

/** «… : پایبندی ۷۰٪، تکمیل ۹۰٪ از ۴ موعد» — what the tooltip, the caption and the table say. */
const summaryOf = (point: AppPmDashboardTrendPoint, range: string): string =>
  point.considered === 0
    ? `${range}: موعد گذشته‌ای نبود`
    : `${range}: پایبندی ${performancePercentLabel(point.adherencePercent)}، تکمیل ${performancePercentLabel(point.completionPercent)} از ${formatPersianNumber(point.considered)} موعد`;

/**
 * The SVG `points` of each unbroken run of a series: a point with no percentage (nothing was due)
 * breaks the line rather than dropping it to zero.
 */
const runsOf = (
  placed: readonly PlacedPoint[],
  value: (point: AppPmDashboardTrendPoint) => number | null,
): string[] => {
  const runs: string[][] = [[]];
  for (const { point, position } of placed) {
    const percent = value(point);
    if (percent === null) {
      runs.push([]);
      continue;
    }
    // The app is right-to-left: time runs from the start (right) edge, so x is mirrored here, where
    // SVG has no notion of direction. The HTML markers use `inset-inline-start` and agree.
    runs[runs.length - 1].push(
      `${(1 - position) * VIEW_WIDTH},${VIEW_HEIGHT - (percent / 100) * VIEW_HEIGHT}`,
    );
  }
  return runs.filter((run) => run.length > 1).map((run) => run.join(' '));
};

/**
 * «روند عملکرد» — adherence and completion, per day or per week, as two lines on one 0–100% axis.
 *
 * **A small SVG, not a chart library.** Every maintained Angular chart library draws to a canvas or
 * writes its colours as inline attributes, and either way the colours could not be the
 * `--mat-sys-*` `light-dark()` tokens `make lint-styles` requires, nor follow the colour scheme.
 * Here the lines are SVG strokes and the markers HTML, all coloured by the stylesheet.
 *
 * **Identity is never colour alone.** The theme's two series colours (primary green, tertiary
 * copper) are too close for deuteranopia, so adherence is a solid line with round markers and
 * completion a dashed one with square markers, named in the legend.
 *
 * **Every point can be inspected three ways:** hovering its column shows a tooltip; clicking it
 * selects it — a caption states its figures and the page narrows the follow-up table to its
 * occurrences (`pointChosen`); and «جدول روند» lists every point as a table row with its own
 * «نمایش» button. The plot itself is `aria-hidden`: the table is its text alternative and the
 * keyboard's way in, so the hit areas stay out of the tab order.
 */
@Component({
  selector: 'app-pm-trend-chart',
  imports: [
    Icon,
    MatButton,
    MatButtonToggle,
    MatButtonToggleGroup,
    MatCell,
    MatCellDef,
    MatColumnDef,
    MatExpansionPanel,
    MatExpansionPanelHeader,
    MatExpansionPanelTitle,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatIcon,
    MatRow,
    MatRowDef,
    MatTable,
    MatTooltip,
    PersianNumberPipe,
    StackedTable,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="trend-chart stack stack--tight">
      <div class="trend-chart__bar">
        <h3 class="trend-chart__title">روند عملکرد</h3>
        <mat-button-toggle-group
          aria-label="بازه روند"
          hideSingleSelectionIndicator
          [value]="granularity()"
          (change)="granularity.set($event.value)"
        >
          <mat-button-toggle value="daily">روزانه</mat-button-toggle>
          <mat-button-toggle value="weekly">هفتگی</mat-button-toggle>
        </mat-button-toggle-group>
      </div>

      <ul class="trend-chart__legend" aria-label="راهنمای نمودار">
        <li><span class="trend-chart__key trend-chart__key--adherence"></span>درصد پایبندی</li>
        <li><span class="trend-chart__key trend-chart__key--completion"></span>درصد تکمیل</li>
      </ul>

      @if (placed().length === 0) {
        <p class="trend-chart__empty">در این بازه موعد گذشته‌ای نیست.</p>
      } @else {
        <div class="trend-chart__frame">
          <div class="trend-chart__plot" aria-hidden="true">
            <div class="trend-chart__grid">
              @for (tick of ticks; track tick) {
                <span class="trend-chart__tick" [style.inset-block-end.%]="tick">
                  <span class="trend-chart__tick-label">{{ tick | persianNumber }}٪</span>
                </span>
              }
            </div>
            <div class="trend-chart__area">
              <svg
                class="trend-chart__lines"
                [attr.viewBox]="viewBox"
                preserveAspectRatio="none"
                focusable="false"
              >
                @for (run of adherenceRuns(); track $index) {
                  <polyline
                    class="trend-chart__line trend-chart__line--adherence"
                    vector-effect="non-scaling-stroke"
                    [attr.points]="run"
                  />
                }
                @for (run of completionRuns(); track $index) {
                  <polyline
                    class="trend-chart__line trend-chart__line--completion"
                    vector-effect="non-scaling-stroke"
                    [attr.points]="run"
                  />
                }
              </svg>
              @for (placedPoint of placed(); track placedPoint.index) {
                @if (placedPoint.point.completionPercent !== null) {
                  <span
                    class="trend-chart__marker trend-chart__marker--completion"
                    [style.inset-inline-start.%]="placedPoint.position * 100"
                    [style.inset-block-end.%]="placedPoint.point.completionPercent"
                  ></span>
                }
                @if (placedPoint.point.adherencePercent !== null) {
                  <span
                    class="trend-chart__marker trend-chart__marker--adherence"
                    [style.inset-inline-start.%]="placedPoint.position * 100"
                    [style.inset-block-end.%]="placedPoint.point.adherencePercent"
                  ></span>
                }
              }
              <div class="trend-chart__hits">
                @for (placedPoint of placed(); track placedPoint.index) {
                  <button
                    type="button"
                    tabindex="-1"
                    class="trend-chart__hit"
                    [class.trend-chart__hit--selected]="selectedIndex() === placedPoint.index"
                    [attr.aria-label]="placedPoint.summary"
                    [matTooltip]="placedPoint.summary"
                    (click)="choose(placedPoint)"
                  ></button>
                }
              </div>
            </div>
          </div>
          <div class="trend-chart__axis" aria-hidden="true">
            <span>{{ placed()[0].range }}</span>
            @if (placed().length > 1) {
              <span>{{ placed()[placed().length - 1].range }}</span>
            }
          </div>
        </div>
      }

      <p class="trend-chart__selection" role="status">
        @if (selected(); as chosen) {
          {{ chosen.summary }}
        }
      </p>

      @if (placed().length > 0) {
        <mat-expansion-panel class="trend-chart__table">
          <mat-expansion-panel-header>
            <mat-panel-title>جدول روند</mat-panel-title>
          </mat-expansion-panel-header>
          <div class="trend-chart__table-body" appStackedTable>
            <table mat-table [dataSource]="placed()" aria-label="جدول روند عملکرد">
              <ng-container matColumnDef="range">
                <th mat-header-cell *matHeaderCellDef>بازه</th>
                <td mat-cell *matCellDef="let row">{{ row.range }}</td>
              </ng-container>
              <ng-container matColumnDef="considered">
                <th mat-header-cell *matHeaderCellDef><span class="cell-end">موعدها</span></th>
                <td mat-cell *matCellDef="let row">
                  <span class="cell-end">{{ row.point.considered | persianNumber }}</span>
                </td>
              </ng-container>
              <ng-container matColumnDef="adherence">
                <th mat-header-cell *matHeaderCellDef><span class="cell-end">پایبندی</span></th>
                <td mat-cell *matCellDef="let row">
                  <span class="cell-end">{{ percent(row.point.adherencePercent) }}</span>
                </td>
              </ng-container>
              <ng-container matColumnDef="completion">
                <th mat-header-cell *matHeaderCellDef><span class="cell-end">تکمیل</span></th>
                <td mat-cell *matCellDef="let row">
                  <span class="cell-end">{{ percent(row.point.completionPercent) }}</span>
                </td>
              </ng-container>
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
                      [attr.aria-label]="'نمایش موعدهای ' + row.range"
                      (click)="choose(row)"
                    >
                      <mat-icon appIcon="filter" />نمایش
                    </button>
                  </div>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
            </table>
          </div>
        </mat-expansion-panel>
      }
    </div>
  `,
  styleUrl: './pm-trend-chart.scss',
})
export class PmTrendChart {
  readonly daily = input<readonly AppPmDashboardTrendPoint[]>([]);
  readonly weekly = input<readonly AppPmDashboardTrendPoint[]>([]);
  /** A point was clicked, in the plot or in its table row. */
  readonly pointChosen = output<AppPmDashboardTrendPoint>();

  /** Weekly first: a 90-day period is 89 daily points but 13 weekly ones. */
  protected readonly granularity = signal<PmTrendGranularity>('weekly');

  protected readonly viewBox = `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`;
  protected readonly ticks = [0, 50, 100];
  protected readonly displayedColumns = DISPLAYED_COLUMNS;
  protected readonly percent = performancePercentLabel;

  protected readonly placed = computed<readonly PlacedPoint[]>(() => {
    const points = this.granularity() === 'daily' ? this.daily() : this.weekly();
    return points.map((point, index) => {
      const range = trendRangeLabel(point);
      return {
        index,
        // The centre of the point's own column, so the first and last never sit on the frame.
        position: (index + 0.5) / points.length,
        point,
        range,
        summary: summaryOf(point, range),
      };
    });
  });

  /** Forgotten whenever the points change — another granularity, period or equipment. */
  protected readonly selectedIndex = linkedSignal<readonly PlacedPoint[], number | null>({
    source: this.placed,
    computation: () => null,
  });

  protected readonly selected = computed(() => {
    const index = this.selectedIndex();
    return index === null ? null : (this.placed()[index] ?? null);
  });

  protected readonly adherenceRuns = computed(() =>
    runsOf(this.placed(), (point) => point.adherencePercent),
  );
  protected readonly completionRuns = computed(() =>
    runsOf(this.placed(), (point) => point.completionPercent),
  );

  protected choose(placedPoint: PlacedPoint): void {
    this.selectedIndex.set(placedPoint.index);
    this.pointChosen.emit(placedPoint.point);
  }
}
