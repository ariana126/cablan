import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
import { form, FormField, maxLength, required, submit, validate } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { firstValueFrom } from 'rxjs';

import { AppQcActivity, QcActivitiesGateway } from '../../core/qc/qc-activities-gateway';
import { CorrectionConfirmation } from '../../ui/correction-confirmation/correction-confirmation';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { Icon } from '../../ui/icon/icon';
import {
  mapQcActivityFormError,
  QC_ACTIVITY_NAME_MAX_LENGTH,
  QC_ACTIVITY_NAME_REQUIRED,
  QC_ACTIVITY_NAME_TOO_LONG,
  QcActivityFormModel,
} from './server-errors';

export type QcActivityFormDialogData =
  { readonly mode: 'create' } | { readonly mode: 'edit'; readonly activity: AppQcActivity };

/**
 * Defines a QC activity («تعریف فعالیت QC»), or renames one («ویرایش فعالیت QC») — its one field is
 * «عنوان فعالیت». A blank title (spaces included) is the field's `mat-error` on submit; «ثبت» never
 * disables for it. A rename of an activity in use is refused in the dialog's alert, except the
 * System Admin's correction (`CorrectionConfirmation`, issue #110's exception granted by #119).
 */
@Component({
  selector: 'app-qc-activity-form-dialog',
  imports: [
    DialogHead,
    ErrorBanner,
    FormField,
    Icon,
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatError,
    MatFormField,
    MatIcon,
    MatInput,
    MatLabel,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-head
      [heading]="data.mode === 'create' ? 'تعریف فعالیت QC' : 'ویرایش فعالیت QC'"
      [subtitle]="data.mode === 'create' ? 'فیلدهای ستاره‌دار الزامی است.' : data.activity.name"
    />

    <form novalidate (submit)="onSubmit(); $event.preventDefault()">
      <mat-dialog-content class="stack">
        @if (activityForm().errors().length) {
          <app-error-banner [message]="activityForm().errors()[0].message ?? ''" />
        }

        <mat-form-field appearance="outline">
          <mat-label>عنوان فعالیت</mat-label>
          <input matInput [formField]="activityForm.name" autocomplete="off" />
          @if (activityForm.name().touched() && activityForm.name().errors().length) {
            <mat-error>{{ activityForm.name().errors()[0].message }}</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions class="dialog-footer">
        <button matButton type="button" mat-dialog-close>
          <mat-icon appIcon="cancel" />انصراف
        </button>
        <button matButton="filled" type="submit" [disabled]="activityForm().submitting()">
          <!-- One icon outside the branches, so it lands in the button's icon slot (NG8011). -->
          <mat-icon [appIcon]="data.mode === 'create' ? 'check' : 'save'" />
          {{ data.mode === 'create' ? 'ثبت' : 'ذخیره تغییرات' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styleUrl: './qc-activity-form-dialog.scss',
})
export class QcActivityFormDialog {
  private readonly dialogRef = inject(MatDialogRef<QcActivityFormDialog, boolean>);
  protected readonly data = inject<QcActivityFormDialogData>(MAT_DIALOG_DATA);
  private readonly gateway = inject(QcActivitiesGateway);
  private readonly correction = inject(CorrectionConfirmation);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly model = signal<QcActivityFormModel>({
    name: this.data.mode === 'edit' ? this.data.activity.name : '',
  });

  protected readonly activityForm = form(this.model, (path) => {
    required(path.name, { message: QC_ACTIVITY_NAME_REQUIRED });
    // Also writes `maxlength` on the input, so the title cannot be typed past the API's limit.
    maxLength(path.name, QC_ACTIVITY_NAME_MAX_LENGTH, { message: QC_ACTIVITY_NAME_TOO_LONG });
    validate(path.name, ({ value }) =>
      value() !== '' && value().trim() === ''
        ? { kind: 'required', message: QC_ACTIVITY_NAME_REQUIRED }
        : undefined,
    );
  });

  protected onSubmit(): Promise<boolean> {
    return submit(this.activityForm, async () => {
      try {
        const { name } = this.model();
        if (this.data.mode === 'create') {
          await firstValueFrom(this.gateway.define(name));
        } else {
          const { id } = this.data.activity;
          // The title is the activity's one field, so every edit is a correctable one.
          const outcome = await this.correction.save(
            (applyToRelatedRecords) => this.gateway.rename(id, name, applyToRelatedRecords),
            true,
            this.host.nativeElement.querySelector('input'),
          );
          if (outcome === 'declined') {
            return undefined;
          }
        }
        this.dialogRef.close(true);
        return undefined;
      } catch (error) {
        return mapQcActivityFormError(error, this.activityForm);
      }
    });
  }
}
