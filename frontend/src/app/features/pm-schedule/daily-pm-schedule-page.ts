import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
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
import { groupBySpecialty, SpecialtyGroup } from '../../core/maintenance/specialty-groups';
import { DataSheet } from '../../ui/data-sheet/data-sheet';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { PageHeader } from '../../ui/page-header/page-header';
import { PersianNumberPipe } from '../../ui/persian-number/persian-number-pipe';
import { PmStatusBadge } from '../../ui/pm-status-badge/pm-status-badge';
import { SpecialtyGroup as SpecialtyGroupSection } from '../../ui/specialty-group/specialty-group';
import { RecordExecutionDialog } from './record-execution-dialog';
import { Icon } from '../../ui/icon/icon';

const DISPLAYED_COLUMNS = ['equipment', 'activity', 'dueDate', 'status', 'daysOverdue', 'actions'];

/** One equipment's share of today's work, split by specialty. */
interface EquipmentTasks {
  readonly equipmentId: string;
  readonly equipmentName: string;
  readonly groups: readonly SpecialtyGroup<AppDailyPmTask>[];
}

/** By equipment in the order the API first names each, then by specialty; order kept inside. */
const byEquipment = (tasks: readonly AppDailyPmTask[]): EquipmentTasks[] => {
  const equipmentIds = [...new Set(tasks.map((task) => task.equipmentId))];
  return equipmentIds.map((equipmentId) => {
    const own = tasks.filter((task) => task.equipmentId === equipmentId);
    return {
      equipmentId,
      equipmentName: own[0].equipmentName,
      groups: groupBySpecialty(own, (task) => task.activitySpecialty),
    };
  });
};

/**
 * `/pm-schedule/daily` — «برنامه روزانه PM» under «فنی». Today's work: everything due today
 * (سررسیده) or past its due date and not yet done (عقب افتاده), each with its own «ثبت انجام».
 * "Today" is the API's — the Tehran date of its clock — so the list is never filtered here.
 *
 * The list is grouped (issue #108): one section per equipment, headed by its name, and inside it one
 * table per specialty («برق», «مکانیک», «تخصص تعیین نشده») — each keeping every column, «تجهیز»
 * included, so a row reads the same whichever table it is in. The API's order holds inside each.
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
          @for (equipment of equipmentTasks(); track equipment.equipmentId) {
            <section
              class="equipment-tasks"
              [attr.aria-labelledby]="'daily-equipment-' + equipment.equipmentId"
            >
              <h3 class="equipment-tasks__title" [id]="'daily-equipment-' + equipment.equipmentId">
                {{ equipment.equipmentName }}
              </h3>
              @for (group of equipment.groups; track group.specialty) {
                <app-specialty-group [specialty]="group.specialty" [level]="4">
                  <table mat-table [dataSource]="group.items">
                    <ng-container matColumnDef="equipment">
                      <th mat-header-cell *matHeaderCellDef>تجهیز</th>
                      <td mat-cell *matCellDef="let task">{{ task.equipmentName }}</td>
                    </ng-container>

                    <ng-container matColumnDef="activity">
                      <th mat-header-cell *matHeaderCellDef>فعالیت</th>
                      <td mat-cell *matCellDef="let task">{{ task.activityName }}</td>
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
                        <span class="cell-end">{{ task.daysOverdue | persianNumber }}</span>
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
                    <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
                  </table>
                </app-specialty-group>
              }
            </section>
          }
        }
      </app-data-sheet>
    </div>
  `,
  styleUrl: './pm-schedule-page.scss',
})
export class DailyPmSchedulePage {
  private readonly gateway = inject(PmScheduleGateway);
  private readonly dialog = inject(MatDialog);

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
        }
      });
  }
}
