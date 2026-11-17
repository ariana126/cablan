import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
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

import { AppQcActivityStatus, AppQcEquipment } from '../../core/qc/qc-equipment-gateway';
import { DataSheet } from '../../ui/data-sheet/data-sheet';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { Icon } from '../../ui/icon/icon';
import { qcLastExecution } from '../../core/qc/qc-time';
import { AddQcActivityDialog } from './add-qc-activity-dialog';
import { ConfirmUnassignQcActivityDialog } from './confirm-unassign-qc-activity-dialog';

let nextId = 0;

/**
 * «فعالیت‌های QC تجهیز» — the first section of an equipment's QC folder (issue #119): the QC
 * activities assigned to it now, by name, each with its last execution there, ever («بدون سابقه»
 * when none). «افزودن فعالیت» assigns one more of the catalog's; «حذف تخصیص» on a row removes one
 * (its records stay). A retired equipment's list is read-only, under a note saying so.
 *
 * It takes the folder's equipment as an input and emits `changed` after a dialog changed the
 * assignments; the folder then re-reads it.
 */
@Component({
  selector: 'app-qc-assigned-activities-section',
  imports: [
    DataSheet,
    EmptyState,
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-data-sheet
      heading="فعالیت‌های QC تجهیز"
      [count]="equipment().activities.length"
      [loading]="loading()"
      loadingLabel="در حال بارگذاری فعالیت‌های QC تجهیز"
    >
      <ng-container ngProjectAs="[sheetActions]">
        @if (editable()) {
          <button #addButton matButton="outlined" type="button" (click)="openAddDialog()">
            <mat-icon appIcon="add" />
            افزودن فعالیت
          </button>
        }
      </ng-container>

      <ng-container ngProjectAs="[sheetChips]">
        @if (!editable()) {
          <p class="assigned-section__note">
            <mat-icon appIcon="block" />
            این تجهیز کنار گذاشته شده است؛ فعالیت‌های QC آن فقط برای مشاهده است.
          </p>
        }
      </ng-container>

      @if (equipment().activities.length === 0) {
        <app-empty-state message="هنوز هیچ فعالیت QC به این تجهیز تخصیص داده نشده است." />
      } @else {
        <table mat-table [dataSource]="equipment().activities">
          <ng-container matColumnDef="activity">
            <th mat-header-cell *matHeaderCellDef>فعالیت</th>
            <td
              mat-cell
              *matCellDef="let activity"
              class="assigned-section__activity"
              [id]="cellId(activity)"
            >
              {{ activity.activityName }}
            </td>
          </ng-container>

          <ng-container matColumnDef="lastPerformedAt">
            <th mat-header-cell *matHeaderCellDef><span class="cell-end">آخرین انجام</span></th>
            <td mat-cell *matCellDef="let activity">
              <span
                class="cell-end"
                [class.assigned-section__none]="activity.lastPerformedAt === null"
                >{{ lastExecution(activity.lastPerformedAt) }}</span
              >
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>
              <span class="visually-hidden">عملیات</span>
            </th>
            <td mat-cell *matCellDef="let activity">
              <div class="cell-actions">
                <!-- Named exactly «حذف تخصیص», told apart by its row's activity. -->
                <button
                  matButton
                  class="button--small button--danger"
                  type="button"
                  [attr.aria-describedby]="cellId(activity)"
                  (click)="openUnassignDialog(activity)"
                >
                  <mat-icon appIcon="delete" />
                  حذف تخصیص
                </button>
              </div>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columns()"></tr>
          <tr mat-row *matRowDef="let row; columns: columns()"></tr>
        </table>
      }
    </app-data-sheet>
  `,
  styleUrl: './qc-assigned-activities-section.scss',
})
export class QcAssignedActivitiesSection {
  private readonly dialog = inject(MatDialog);

  readonly equipment = input.required<AppQcEquipment>();
  /** The folder is re-reading the equipment; the rows stay on screen meanwhile. */
  readonly loading = input(false);

  /** After an assignment was added or removed — the folder re-reads the equipment. */
  readonly changed = output<void>();

  private readonly idPrefix = `qc-assigned-${nextId++}`;
  private readonly addButton = viewChild('addButton', { read: ElementRef<HTMLButtonElement> });

  protected readonly lastExecution = qcLastExecution;

  /** Retired equipment is read-only: no assignment is added or removed (the API's 409). */
  protected readonly editable = computed(() => !this.equipment().retired);

  protected readonly columns = computed(() =>
    this.editable() ? ['activity', 'lastPerformedAt', 'actions'] : ['activity', 'lastPerformedAt'],
  );

  protected cellId(activity: AppQcActivityStatus): string {
    return `${this.idPrefix}-${activity.activityId}`;
  }

  protected openAddDialog(): void {
    const { id, name, activities } = this.equipment();
    this.dialog
      .open(AddQcActivityDialog, {
        data: {
          equipment: { id, name },
          assignedActivityIds: activities.map((activity) => activity.activityId),
        },
      })
      .afterClosed()
      .subscribe((added) => {
        if (added === true) {
          this.changed.emit();
        }
      });
  }

  protected openUnassignDialog(activity: AppQcActivityStatus): void {
    const { id, name } = this.equipment();
    this.dialog
      .open(ConfirmUnassignQcActivityDialog, {
        data: { equipment: { id, name }, activity },
        // The row and its button go with the assignment; «افزودن فعالیت» stays.
        restoreFocus: this.addButton()?.nativeElement ?? true,
      })
      .afterClosed()
      .subscribe((removed) => {
        if (removed === true) {
          this.changed.emit();
        }
      });
  }
}
