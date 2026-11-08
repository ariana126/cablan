import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
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
import { MatIcon } from '@angular/material/icon';

import { formatJalaliCalendarDate } from '../../core/date/calendar-date';
import { AppDailyPmTask, PmScheduleGateway } from '../../core/maintenance/pm-schedule-gateway';
import {
  groupBySpecialty,
  MECHANICAL_FIRST,
  SpecialtyGroup,
} from '../../core/maintenance/specialty-groups';
import { DataSheet } from '../../ui/data-sheet/data-sheet';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { PageHeader } from '../../ui/page-header/page-header';
import { PersianNumberPipe } from '../../ui/persian-number/persian-number-pipe';
import { PmStatusBadge } from '../../ui/pm-status-badge/pm-status-badge';
import { SpecialtyGroup as SpecialtyGroupSection } from '../../ui/specialty-group/specialty-group';
import { RecordExecutionDialog } from './record-execution-dialog';
import { Icon } from '../../ui/icon/icon';

const DISPLAYED_COLUMNS = ['activity', 'dueDate', 'status', 'daysOverdue', 'actions'];

/** One equipment's share of today's work, split by specialty. */
interface EquipmentTasks {
  readonly equipmentId: string;
  readonly equipmentName: string;
  /** Everything due on it today, overdue included. */
  readonly dueCount: number;
  readonly overdueCount: number;
  readonly groups: readonly SpecialtyGroup<AppDailyPmTask>[];
}

/**
 * By equipment in the order the API first names each, then by specialty — mechanical first — with
 * the order kept inside. The counts are the API's own rows counted, no rule of the browser's.
 */
const byEquipment = (tasks: readonly AppDailyPmTask[]): EquipmentTasks[] => {
  const equipmentIds = [...new Set(tasks.map((task) => task.equipmentId))];
  return equipmentIds.map((equipmentId) => {
    const own = tasks.filter((task) => task.equipmentId === equipmentId);
    return {
      equipmentId,
      equipmentName: own[0].equipmentName,
      dueCount: own.length,
      overdueCount: own.filter((task) => task.status === 'overdue').length,
      groups: groupBySpecialty(own, (task) => task.activitySpecialty, MECHANICAL_FIRST),
    };
  });
};

/**
 * `/pm-schedule/daily` — «برنامه روزانه PM» under «فنی». Today's work: everything due today
 * (سررسیده) or past its due date and not yet done (عقب افتاده), each with its own «ثبت انجام».
 * "Today" is the API's — the Tehran date of its clock — so the list is never filtered here.
 *
 * The list is grouped (issue #108): one section per equipment, headed by its name, and inside it one
 * table per specialty («مکانیک», «برق», «تخصص تعیین نشده» — issue #112 put mechanical first). The
 * API's order holds inside each.
 *
 * Issue #112 drew each equipment as its own framed box, never collapsed, whose head sums up its
 * work («۳ فعالیت برای انجام», then «۱ عقب افتاده» when any is). The box names the equipment, so
 * its rows don't: a row is the activity, its due date, status and delay, and «ثبت انجام» — still a
 * direct button, never in a menu. An overdue row is marked by more than its status pill: an
 * error-coloured start edge and an alert glyph beside its days overdue. A recording is confirmed by
 * a snackbar, and the list re-reads.
 *
 * The sheet's progress bar shows until the list is in; an empty day then says so in a paragraph
 * instead of drawing any table. Together they are how a reader — or an automated browser — tells
 * "nothing is due" from "not loaded yet".
 */
@Component({
  selector: 'app-daily-pm-schedule-page',
  imports: [
    DataSheet,
    ErrorBanner,
    Icon,
    MatButton,
    MatCell,
    MatCellDef,
    MatColumnDef,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatIcon,
    MatRow,
    MatRowDef,
    MatTable,
    PageHeader,
    PersianNumberPipe,
    PmStatusBadge,
    SpecialtyGroupSection,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page stack">
      <app-page-header
        heading="برنامه روزانه PM"
        description="کارهای تعمیرات پیشگیرانه‌ای که امروز سررسیده یا از موعدشان گذشته است"
      />

      <app-data-sheet
        heading="کارهای امروز"
        [count]="tasksResource.isLoading() || tasksResource.error() ? null : tasks().length"
        [loading]="tasksResource.isLoading()"
        loadingLabel="در حال بارگذاری برنامهٔ امروز"
      >
        @if (tasksResource.status() === 'loading') {
          <!-- First load: the sheet's progress bar says it. A re-read after a recording keeps the
               rows on screen under the same bar. -->
        } @else if (forbidden()) {
          <app-error-banner message="شما دسترسی لازم برای مشاهده این بخش را ندارید." />
        } @else if (tasksResource.error()) {
          <app-error-banner
            message="برنامهٔ امروز بارگذاری نشد."
            retryLabel="تلاش دوباره"
            (retry)="tasksResource.reload()"
          />
        } @else if (tasks().length === 0) {
          <p class="no-data">امروز کار سررسیده یا عقب افتاده‌ای نیست.</p>
        } @else {
          <div class="equipment-boxes">
            @for (equipment of equipmentTasks(); track equipment.equipmentId) {
              <section
                class="equipment-tasks"
                [attr.aria-labelledby]="'daily-equipment-' + equipment.equipmentId"
              >
                <div class="equipment-tasks__head">
                  <h3
                    class="equipment-tasks__title"
                    [id]="'daily-equipment-' + equipment.equipmentId"
                  >
                    {{ equipment.equipmentName }}
                  </h3>
                  <p class="equipment-tasks__summary">
                    <span class="equipment-tasks__count"
                      >{{ equipment.dueCount | persianNumber }} فعالیت برای انجام</span
                    >
                    @if (equipment.overdueCount > 0) {
                      &ngsp;<span class="equipment-tasks__overdue"
                        ><mat-icon class="equipment-tasks__overdue-icon" appIcon="alert" />{{
                          equipment.overdueCount | persianNumber
                        }}
                        عقب افتاده</span
                      >
                    }
                  </p>
                </div>
                @for (group of equipment.groups; track group.specialty) {
                  <app-specialty-group [specialty]="group.specialty" [level]="4">
                    <table mat-table [dataSource]="group.items">
                      <ng-container matColumnDef="activity">
                        <th mat-header-cell *matHeaderCellDef>فعالیت</th>
                        <td mat-cell *matCellDef="let task" class="task-activity">
                          {{ task.activityName }}
                        </td>
                      </ng-container>

                      <ng-container matColumnDef="dueDate">
                        <th mat-header-cell *matHeaderCellDef>
                          <span class="cell-end">موعد</span>
                        </th>
                        <td mat-cell *matCellDef="let task">
                          <span class="cell-end">{{ jalaliDate(task.dueDate) }}</span>
                        </td>
                      </ng-container>

                      <ng-container matColumnDef="status">
                        <th mat-header-cell *matHeaderCellDef>وضعیت</th>
                        <td mat-cell *matCellDef="let task">
                          <app-pm-status-badge [status]="task.status" />
                        </td>
                      </ng-container>

                      <ng-container matColumnDef="daysOverdue">
                        <th mat-header-cell *matHeaderCellDef>
                          <span class="cell-end">روزهای تاخیر</span>
                        </th>
                        <td mat-cell *matCellDef="let task">
                          <span class="cell-end">
                            @if (task.status === 'overdue') {
                              <mat-icon class="task-delay-icon" appIcon="alert" />
                            }
                            {{ task.daysOverdue | persianNumber }}
                          </span>
                        </td>
                      </ng-container>

                      <!-- Visible text «ثبت انجام» leads the accessible name, which adds the task, so each
                 row's button is told apart from the others'. -->
                      <ng-container matColumnDef="actions">
                        <th mat-header-cell *matHeaderCellDef>
                          <span class="visually-hidden">عملیات</span>
                        </th>
                        <td mat-cell *matCellDef="let task">
                          <div class="cell-actions">
                            <button
                              matButton="outlined"
                              class="button--small"
                              type="button"
                              [attr.aria-label]="
                                'ثبت انجام ' + task.activityName + ' ' + task.equipmentName
                              "
                              (click)="openRecordDialog(task)"
                            >
                              <mat-icon appIcon="check-circle" />
                              ثبت انجام
                            </button>
                          </div>
                        </td>
                      </ng-container>

                      <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                      <tr
                        mat-row
                        *matRowDef="let row; columns: displayedColumns"
                        [class.task-row--overdue]="row.status === 'overdue'"
                      ></tr>
                    </table>
                  </app-specialty-group>
                }
              </section>
            }
          </div>
        }
      </app-data-sheet>
    </div>
  `,
  styleUrl: './pm-schedule-page.scss',
})
export class DailyPmSchedulePage {
  private readonly gateway = inject(PmScheduleGateway);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly displayedColumns = DISPLAYED_COLUMNS;

  protected readonly tasksResource = rxResource({
    stream: () => this.gateway.daily(),
    defaultValue: [] as AppDailyPmTask[],
  });

  protected readonly tasks = computed<AppDailyPmTask[]>(() =>
    this.tasksResource.hasValue() ? this.tasksResource.value() : [],
  );

  protected readonly equipmentTasks = computed(() => byEquipment(this.tasks()));

  protected readonly forbidden = computed(() => {
    const error = this.tasksResource.error();
    return error instanceof HttpErrorResponse && error.status === 403;
  });

  protected readonly jalaliDate = formatJalaliCalendarDate;

  protected openRecordDialog(task: AppDailyPmTask): void {
    this.dialog
      .open(RecordExecutionDialog, { data: { task } })
      .afterClosed()
      .subscribe((recorded) => {
        if (recorded === true) {
          this.tasksResource.reload();
          this.snackBar.open(
            `انجام «${task.activityName}» برای «${task.equipmentName}» ثبت شد.`,
            undefined,
            { duration: 5000 },
          );
        }
      });
  }
}
