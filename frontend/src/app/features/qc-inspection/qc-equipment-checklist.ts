import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
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

import { AppQcEquipment } from '../../core/qc/qc-equipment-gateway';
import { qcLastExecution } from '../../core/qc/qc-time';
import { Icon } from '../../ui/icon/icon';
import { QcChecklist } from './qc-checklist';
import {
  QcSubmissionDialog,
  QcSubmissionDialogData,
  QcSubmissionOutcome,
} from './qc-submission-dialog';
import { NOTES_MAX_LENGTH } from './server-errors';

const COLUMNS = ['activity', 'lastPerformedAt'];

/**
 * One equipment on `/qc-inspection` as a checklist (issue #132): a `<section>` named by its `h3` —
 * exactly the equipment's name — around the table «فعالیت» | «آخرین انجام». Each activity is a
 * checkbox named exactly by the activity (and described by the equipment, since one activity is
 * often assigned to several); a ticked one gets its own optional «توضیحات {activity}». The
 * section's «ثبت انجام» opens `QcSubmissionDialog` on the ticked activities, or, with none ticked,
 * says one must be chosen and opens nothing.
 *
 * When the dialog closes, the activities it recorded are unticked and their notes dropped; refused
 * ones stay ticked to try again. `submitted` fires whenever something was sent, for the page to
 * re-read the last executions.
 */
@Component({
  selector: 'app-qc-equipment-checklist',
  imports: [
    Icon,
    MatButton,
    MatCell,
    MatCellDef,
    MatCheckbox,
    MatColumnDef,
    MatFormField,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatIcon,
    MatInput,
    MatLabel,
    MatRow,
    MatRowDef,
    MatTable,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="inspection-box" [attr.aria-labelledby]="headingId()">
      <h3 class="inspection-box__title" [id]="headingId()">{{ equipment().name }}</h3>
      <table mat-table [dataSource]="equipment().activities">
        <ng-container matColumnDef="activity">
          <th mat-header-cell *matHeaderCellDef>فعالیت</th>
          <td mat-cell *matCellDef="let activity" class="inspection-box__activity">
            <mat-checkbox
              [checked]="checklist.isTicked(activity.activityId)"
              [aria-describedby]="headingId()"
              (change)="tick(activity.activityId, $event.checked)"
              >{{ activity.activityName }}</mat-checkbox
            >
            @if (checklist.isTicked(activity.activityId)) {
              <mat-form-field appearance="outline" class="inspection-box__notes">
                <mat-label>توضیحات {{ activity.activityName }}</mat-label>
                <textarea
                  matInput
                  rows="2"
                  [maxLength]="notesMaxLength"
                  [value]="checklist.notesOf(activity.activityId)"
                  (input)="writeNotes(activity.activityId, $event)"
                ></textarea>
              </mat-form-field>
            }
          </td>
        </ng-container>
        <ng-container matColumnDef="lastPerformedAt">
          <th mat-header-cell *matHeaderCellDef>
            <span class="cell-end">آخرین انجام</span>
          </th>
          <td mat-cell *matCellDef="let activity">
            <span
              class="cell-end"
              [class.inspection-box__none]="activity.lastPerformedAt === null"
              >{{ lastExecution(activity.lastPerformedAt) }}</span
            >
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns"></tr>
      </table>

      <div class="inspection-box__footer">
        @if (nothingTickedShown()) {
          <p class="inspection-box__error" role="alert">دست کم یک فعالیت باید انتخاب شود.</p>
        }
        <button
          matButton="outlined"
          type="button"
          [attr.aria-describedby]="headingId()"
          (click)="record()"
        >
          <mat-icon appIcon="check-circle" />
          ثبت انجام
        </button>
      </div>
    </section>
  `,
  styleUrl: './qc-equipment-checklist.scss',
})
export class QcEquipmentChecklist {
  private readonly dialog = inject(MatDialog);

  readonly equipment = input.required<AppQcEquipment>();
  /** Something was sent: the last executions may have moved. */
  readonly submitted = output<void>();

  protected readonly columns = COLUMNS;
  protected readonly lastExecution = qcLastExecution;
  protected readonly notesMaxLength = NOTES_MAX_LENGTH;
  protected readonly checklist = new QcChecklist();

  /** «ثبت انجام» was pressed with nothing ticked, and nothing has been ticked since. */
  protected readonly nothingTickedShown = signal(false);

  protected readonly headingId = computed(() => `qc-inspection-${this.equipment().id}`);

  protected tick(activityId: string, ticked: boolean): void {
    this.checklist.tick(activityId, ticked);
    this.nothingTickedShown.set(false);
  }

  protected writeNotes(activityId: string, event: Event): void {
    this.checklist.writeNotes(activityId, (event.target as HTMLTextAreaElement).value);
  }

  protected record(): void {
    const { id, name, activities } = this.equipment();
    const ticked = this.checklist.tickedAmong(activities.map((activity) => activity.activityId));
    if (ticked.length === 0) {
      this.nothingTickedShown.set(true);
      return;
    }
    const data: QcSubmissionDialogData = {
      equipment: { id, name },
      activities: ticked.map(({ activityId, notes }) => ({
        activityId,
        activityName:
          activities.find((activity) => activity.activityId === activityId)?.activityName ?? '',
        notes,
      })),
    };
    this.dialog
      .open<QcSubmissionDialog, QcSubmissionDialogData, QcSubmissionOutcome>(QcSubmissionDialog, {
        data,
        // Every way out — Escape and a click outside too — goes through the dialog, which closes
        // with what it sent and recorded.
        disableClose: true,
      })
      .afterClosed()
      .subscribe((outcome) => {
        if (outcome === undefined || !outcome.sent) {
          return;
        }
        this.checklist.clear(outcome.recorded);
        this.submitted.emit();
      });
  }
}
