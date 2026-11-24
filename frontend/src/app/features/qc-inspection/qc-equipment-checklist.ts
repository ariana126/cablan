import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
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
import { newSubmissionId } from '../../core/qc/submission-id';
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
 * One scanned equipment's checklist (issue #132), the body of `QcRecordingDialog`: the table
 * «فعالیت» | «آخرین انجام», each activity a checkbox named exactly by the activity; a ticked one
 * gets its own optional «توضیحات {activity}». It names no equipment itself — only that equipment is
 * offered, under the dialog's title. «ثبت انجام» opens `QcSubmissionDialog` on the ticked
 * activities, stacked over the recording dialog, or, with none ticked, says one must be chosen and
 * opens nothing.
 *
 * The ticks, notes and any pending submission live in the `checklist` it is given — the page's,
 * which outlives the dialog, so a submission whose answer never came is resumed on the next scan.
 * When the submission dialog closes, the activities it recorded are unticked and their notes
 * dropped; refused ones stay ticked to try again. `submitted` fires whenever something was sent.
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
    <table mat-table [dataSource]="equipment().activities">
      <ng-container matColumnDef="activity">
        <th mat-header-cell *matHeaderCellDef>فعالیت</th>
        <td mat-cell *matCellDef="let activity" class="checklist__activity">
          <mat-checkbox
            [checked]="checklist().isTicked(activity.activityId)"
            (change)="tick(activity.activityId, $event.checked)"
            >{{ activity.activityName }}</mat-checkbox
          >
          @if (checklist().isTicked(activity.activityId)) {
            <mat-form-field appearance="outline" class="checklist__notes">
              <mat-label>توضیحات {{ activity.activityName }}</mat-label>
              <textarea
                matInput
                rows="2"
                [maxLength]="notesMaxLength"
                [value]="checklist().notesOf(activity.activityId)"
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
          <span class="cell-end" [class.checklist__none]="activity.lastPerformedAt === null">{{
            lastExecution(activity.lastPerformedAt)
          }}</span>
        </td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let row; columns: columns"></tr>
    </table>

    <div class="checklist__footer">
      @if (nothingTickedShown()) {
        <p class="checklist__error" role="alert">دست کم یک فعالیت باید انتخاب شود.</p>
      }
      <button matButton="outlined" type="button" (click)="record()">
        <mat-icon appIcon="check-circle" />
        ثبت انجام
      </button>
    </div>
  `,
  styleUrl: './qc-equipment-checklist.scss',
})
export class QcEquipmentChecklist {
  private readonly dialog = inject(MatDialog);

  readonly equipment = input.required<AppQcEquipment>();
  /** The equipment's ticks, notes and pending submission — held by the page, not by this view. */
  readonly checklist = input.required<QcChecklist>();
  /** Something was sent: the last executions may have moved. */
  readonly submitted = output<void>();

  protected readonly columns = COLUMNS;
  protected readonly lastExecution = qcLastExecution;
  protected readonly notesMaxLength = NOTES_MAX_LENGTH;

  /** «ثبت انجام» was pressed with nothing ticked, and nothing has been ticked since. */
  protected readonly nothingTickedShown = signal(false);

  protected tick(activityId: string, ticked: boolean): void {
    this.checklist().tick(activityId, ticked);
    this.nothingTickedShown.set(false);
  }

  protected writeNotes(activityId: string, event: Event): void {
    this.checklist().writeNotes(activityId, (event.target as HTMLTextAreaElement).value);
  }

  protected record(): void {
    const { id, name, activities } = this.equipment();
    const checklist = this.checklist();
    const offered = activities.map((activity) => activity.activityId);
    const ticked = checklist.tickedAmong(offered);
    if (ticked.length === 0) {
      this.nothingTickedShown.set(true);
      return;
    }
    // The same activities sent before without an answer go again under the same id, so nothing
    // already recorded is recorded twice; anything else is a new submission.
    const submission = checklist.pendingSubmission(offered) ?? {
      submissionId: newSubmissionId(),
      trackingNumber: '',
    };
    const data: QcSubmissionDialogData = {
      equipment: { id, name },
      activities: ticked.map(({ activityId, notes }) => ({
        activityId,
        activityName:
          activities.find((activity) => activity.activityId === activityId)?.activityName ?? '',
        notes,
      })),
      submission,
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
        if (outcome === undefined) {
          return;
        }
        if (outcome.settled) {
          checklist.release();
        } else if (outcome.trackingNumber !== '') {
          checklist.hold(
            { submissionId: submission.submissionId, trackingNumber: outcome.trackingNumber },
            offered,
          );
        }
        if (!outcome.sent) {
          return;
        }
        checklist.clear(outcome.recorded);
        this.submitted.emit();
      });
  }
}
