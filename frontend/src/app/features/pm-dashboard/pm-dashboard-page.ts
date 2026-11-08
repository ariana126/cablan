import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { form, FormField } from '@angular/forms/signals';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatTooltip } from '@angular/material/tooltip';
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
import { RouterLink } from '@angular/router';

import { formatJalaliCalendarDate } from '../../core/date/calendar-date';
import { formatJalaliDateTime } from '../../core/date/jalali-datetime';
import { formatPersianNumber } from '../../core/i18n/persian-numerals';
import { AppEquipment, EquipmentGateway } from '../../core/maintenance/equipment-gateway';
import {
  AppPmDashboard,
  AppPmDashboardQuery,
  PmDashboardGateway,
  PmDashboardPeriod,
} from '../../core/maintenance/pm-dashboard-gateway';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { Icon, IconName } from '../../ui/icon/icon';
import { PageHeader } from '../../ui/page-header/page-header';
import { PersianNumberPipe } from '../../ui/persian-number/persian-number-pipe';
import { StackedTable } from '../../ui/stacked-table/stacked-table';
import {
  averageDaysLateLabel,
  coveragePercentLabel,
  performancePercentLabel,
} from './pm-dashboard-figures';
import { PmFollowUpFocus } from './pm-follow-up';
import { PmFollowUpSheet } from './pm-follow-up-sheet';
import { PmTrendChart } from './pm-trend-chart';

/** The page's two server-side filters. `''` is «همه تجهیزات» — signal forms take no `null`. */
interface PmDashboardFilterModel {
  readonly periodDays: PmDashboardPeriod;
  readonly equipmentId: string;
}

type CardKind = 'due-today' | 'overdue' | 'done-today' | 'missed';

interface PmDashboardCard {
  readonly kind: CardKind;
  readonly title: string;
  readonly value: number;
  /** Carries no digit before the value, so the card's first number is its figure. */
  readonly note: string;
  readonly icon: IconName;
  /** The status tone: attention, error or positive — always with its icon and words. */
  readonly tone: 'attention' | 'error' | 'positive';
}

const PERIODS: readonly { readonly value: PmDashboardPeriod; readonly label: string }[] = [
  { value: 7, label: '7 روز اخیر' },
  { value: 30, label: '30 روز اخیر' },
  { value: 90, label: '90 روز اخیر' },
];

const RETIRED_MARK = '(کنار گذاشته شده)';

/** The donut's ring has a circumference of 100 user units, so a percentage is its own dash. */
const RING_RADIUS = 100 / (2 * Math.PI);

const cardsOf = (dashboard: AppPmDashboard): readonly PmDashboardCard[] => [
  {
    kind: 'due-today',
    title: 'سررسید امروز',
    value: dashboard.current.dueToday,
    note: 'موعد امروز، هنوز انجام نشده',
    icon: 'calendar',
    tone: 'attention',
  },
  {
    kind: 'overdue',
    title: 'عقب افتاده',
    value: dashboard.current.overdue,
    note: 'گذشته از موعد، هنوز قابل انجام',
    icon: 'clock',
    tone: 'error',
  },
  {
    kind: 'done-today',
    title: 'انجام شده امروز',
    value: dashboard.current.doneToday,
    note: 'ثبت شده در امروز',
    icon: 'check-circle',
    tone: 'positive',
  },
  {
    kind: 'missed',
    title: 'موعدهای ازدست رفته',
    value: dashboard.missedCount,
    note: `در ${formatPersianNumber(dashboard.periodDays)} روز اخیر`,
    icon: 'block',
    tone: 'error',
  },
];

/**
 * `/pm-dashboard` — «داشبورد مدیریتی فنی», first under «فنی» (issue #89), for the System Admin and
 * the Technical Manager. One request (`GET /pm-dashboard`) per choice of «بازه زمانی» and «تجهیز»
 * answers every panel, so all of them stand on the API's one "today":
 *
 * - **Today's four cards** — due today, overdue, done today, and the period's missed occurrences —
 *   each a toggle button that narrows the follow-up table to what it counts.
 * - **«عملکرد PM»** — adherence and completion over the period's past due dates, with the
 *   daily/weekly trend (`PmTrendChart`), whose points narrow the table too.
 * - **«پوشش برنامه PM»** — plant-wide, whatever equipment is chosen; «فاقد برنامه» lists the
 *   equipment without a plan as links to their technical files.
 * - **«بیشترین عقب افتادگی»** and **«برنامه هفت روز آینده»** — two short tables; a row of the first
 *   narrows the table to that equipment's overdue work.
 * - **«فعالیت های نیازمند پیگیری»** (`PmFollowUpSheet`) — search, status, sort, details, «ثبت انجام»
 *   and «خروجی اکسل».
 *
 * While a new choice loads, the previous figures stay on screen under a progress bar that appears
 * in the same render as the choice, and goes once every panel holds the answer.
 */
@Component({
  selector: 'app-pm-dashboard-page',
  imports: [
    ErrorBanner,
    FormField,
    Icon,
    MatButton,
    MatCell,
    MatCellDef,
    MatColumnDef,
    MatFormField,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatIcon,
    MatIconButton,
    MatLabel,
    MatOption,
    MatProgressBar,
    MatRow,
    MatRowDef,
    MatSelect,
    MatTable,
    MatTooltip,
    PageHeader,
    PersianNumberPipe,
    PmFollowUpSheet,
    PmTrendChart,
    RouterLink,
    StackedTable,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pm-dashboard-page.html',
  styleUrl: './pm-dashboard-page.scss',
})
export class PmDashboardPage {
  private readonly gateway = inject(PmDashboardGateway);
  private readonly equipmentGateway = inject(EquipmentGateway);
  private readonly document = inject(DOCUMENT);

  protected readonly periods = PERIODS;
  protected readonly ringRadius = RING_RADIUS;
  protected readonly mostOverdueColumns = [
    'equipment',
    'overdueCount',
    'totalDaysOverdue',
    'actions',
  ];
  protected readonly upcomingColumns = ['equipment', 'activity', 'dueDate'];

  protected readonly jalaliDate = formatJalaliCalendarDate;
  protected readonly performancePercent = performancePercentLabel;

  /** What the two percentages mean (issue #112) — the API's definitions, in the page's words. */
  protected readonly adherenceExplanation = 'سهم موعدهای گذشتهٔ این بازه که بموقع انجام شده‌اند.';
  protected readonly completionExplanation =
    'سهم موعدهای گذشتهٔ این بازه که انجام شده‌اند، بموقع یا با تاخیر.';
  protected readonly coveragePercent = coveragePercentLabel;
  protected readonly averageDaysLate = averageDaysLateLabel;

  private readonly filters = signal<PmDashboardFilterModel>({ periodDays: 30, equipmentId: '' });
  protected readonly filtersForm = form(this.filters);

  private readonly query = computed<AppPmDashboardQuery>(() => ({
    periodDays: this.filters().periodDays,
    equipmentId: this.filters().equipmentId === '' ? null : this.filters().equipmentId,
  }));

  protected readonly dashboardResource = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.gateway.dashboard(params),
  });

  /** The last answer, kept on screen while the next one loads. */
  protected readonly dashboard = linkedSignal<AppPmDashboard | undefined, AppPmDashboard | null>({
    source: () => (this.dashboardResource.hasValue() ? this.dashboardResource.value() : undefined),
    computation: (value, previous) => value ?? previous?.value ?? null,
  });

  private readonly equipmentResource = rxResource({
    stream: () => this.equipmentGateway.list(),
    defaultValue: [] as AppEquipment[],
  });

  protected readonly equipmentOptions = computed(() =>
    (this.equipmentResource.hasValue() ? this.equipmentResource.value() : []).map((equipment) => ({
      id: equipment.id,
      label: equipment.retired ? `${equipment.name} ${RETIRED_MARK}` : equipment.name,
    })),
  );

  protected readonly forbidden = computed(() => {
    const error = this.dashboardResource.error();
    return error instanceof HttpErrorResponse && error.status === 403;
  });

  protected readonly cards = computed(() => {
    const dashboard = this.dashboard();
    return dashboard === null ? [] : cardsOf(dashboard);
  });

  /** What the follow-up table is narrowed to; a new period or equipment lifts it. */
  protected readonly focus = linkedSignal<AppPmDashboardQuery, PmFollowUpFocus | null>({
    source: this.query,
    computation: () => null,
  });

  /** «فاقد برنامه»'s list, folded again by every new answer. */
  protected readonly withoutPlanOpen = linkedSignal({
    source: this.dashboard,
    computation: () => false,
  });

  /** In the viewer's own time zone, like every other instant the app shows. */
  protected updatedAt(dashboard: AppPmDashboard): string {
    const instant = new Date(dashboard.generatedAt);
    return Number.isNaN(instant.getTime()) ? '—' : formatJalaliDateTime(instant);
  }

  protected toggleCard(kind: CardKind): void {
    if (this.focus()?.kind === kind) {
      this.focus.set(null);
    } else {
      this.focusOn({ kind });
    }
  }

  /** Narrows the follow-up table and brings it into view; focus stays on what was clicked. */
  protected focusOn(focus: PmFollowUpFocus): void {
    this.focus.set(focus);
    const reducedMotion =
      this.document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;
    this.document
      .getElementById('pm-follow-up')
      ?.scrollIntoView?.({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' });
  }
}
