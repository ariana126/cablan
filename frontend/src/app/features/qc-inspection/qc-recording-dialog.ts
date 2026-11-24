import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { filter } from 'rxjs';

import { AppQcEquipment } from '../../core/qc/qc-equipment-gateway';
import { QcInspectionsGateway } from '../../core/qc/qc-inspections-gateway';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { Icon } from '../../ui/icon/icon';
import { QcChecklist } from './qc-checklist';
import { QcEquipmentChecklist } from './qc-equipment-checklist';

export interface QcRecordingDialogData {
  /** The equipment just scanned, as the scan read it: in service, with activities assigned. */
  readonly equipment: AppQcEquipment;
  /** Its checklist, held by the page so a pending submission outlives this dialog. */
  readonly checklist: QcChecklist;
}

/**
 * Recording QC activities, reached only through a scan of the equipment's QR (issue #119; the
 * checklist is issue #132's): the code on the machine is the proof the person stood at it, so this
 * dialog offers that one equipment and nothing else. Its title — exactly the equipment's name — is
 * its accessible name; its body is the equipment's checklist (`QcEquipmentChecklist`), whose «ثبت
 * انجام» stacks `QcSubmissionDialog` over it.
 *
 * Once something was sent, the equipment is read again so «آخرین انجام» moves here too. It closes
 * with whether anything was sent, for the page to re-read its list — by «پایان», Escape or a click
 * outside alike; open it with `disableClose: true`. The head has no close button and nothing here
 * is named «بستن»: that name is the submission dialog's sign that its answer is in.
 */
@Component({
  selector: 'app-qc-recording-dialog',
  imports: [
    DialogHead,
    Icon,
    MatButton,
    MatDialogActions,
    MatDialogContent,
    MatIcon,
    QcEquipmentChecklist,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-head
      [heading]="equipment().name"
      subtitle="فعالیت‌های انجام‌شده را علامت بزنید و ثبت کنید."
      [showClose]="false"
    />

    <mat-dialog-content>
      <app-qc-equipment-checklist
        [equipment]="equipment()"
        [checklist]="data.checklist"
        (submitted)="onSubmitted()"
      />
    </mat-dialog-content>

    <mat-dialog-actions class="dialog-footer">
      <button matButton type="button" (click)="close()">
        <mat-icon appIcon="close" />
        پایان
      </button>
    </mat-dialog-actions>
  `,
  styleUrl: './qc-recording-dialog.scss',
})
export class QcRecordingDialog {
  protected readonly data = inject<QcRecordingDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<QcRecordingDialog, boolean>>(MatDialogRef);
  private readonly gateway = inject(QcInspectionsGateway);
  private readonly destroyRef = inject(DestroyRef);

  /** The equipment as last read — read again after every sending, for its last executions. */
  protected readonly equipment = signal<AppQcEquipment>(this.data.equipment);
  /** Whether anything went out that may have recorded something. */
  private readonly sent = signal(false);

  constructor() {
    // The stacked submission dialog takes Escape and the backdrop while it is open: both reach the
    // topmost dialog only.
    this.dialogRef
      .keydownEvents()
      .pipe(
        filter((event) => event.key === 'Escape'),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.close());
    this.dialogRef
      .backdropClick()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.close());
  }

  protected close(): void {
    this.dialogRef.close(this.sent());
  }

  protected onSubmitted(): void {
    this.sent.set(true);
    // Unread, the last executions shown stay as they were; the page re-reads its own on close.
    this.gateway
      .get(this.data.equipment.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (equipment) => this.equipment.set(equipment), error: () => undefined });
  }
}
