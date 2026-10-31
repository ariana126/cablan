import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { form, FormField, required, submit, validate } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatIcon } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';

import {
  AppMaintenanceActivity,
  MaintenanceActivitiesGateway,
} from '../../core/maintenance/maintenance-activities-gateway';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import {
  ACTIVITY_NAME_REQUIRED,
  mapMaintenanceActivityFormError,
  MaintenanceActivityFormModel,
} from './server-errors';
import { Icon } from '../../ui/icon/icon';

export type MaintenanceActivityFormDialogData =
  | { readonly mode: 'create' }
  | { readonly mode: 'edit'; readonly activity: AppMaintenanceActivity };

/** Adds an activity to the catalog, or renames one. */
@Component({
  selector: 'app-maintenance-activity-form-dialog',
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
      [heading]="data.mode === 'create' ? 'افزودن فعالیت' : 'ویرایش فعالیت'"
      [subtitle]="data.mode === 'create' ? 'فیلدهای ستاره‌دار الزامی است.' : data.activity.name"
    />

    <form novalidate (submit)="onSubmit(); $event.preventDefault()">
      <mat-dialog-content class="stack">
        @if (activityForm().errors().length) {
          <app-error-banner [message]="activityForm().errors()[0].message ?? ''" />
        }

        <mat-form-field appearance="outline">
          <mat-label>نام فعالیت</mat-label>
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
          <mat-icon appIcon="check" />
          ثبت فعالیت
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styleUrl: './maintenance-activity-form-dialog.scss',
})
export class MaintenanceActivityFormDialog {
  private readonly dialogRef = inject(MatDialogRef<MaintenanceActivityFormDialog, boolean>);
  protected readonly data = inject<MaintenanceActivityFormDialogData>(MAT_DIALOG_DATA);
  private readonly gateway = inject(MaintenanceActivitiesGateway);

  private readonly model = signal<MaintenanceActivityFormModel>({
    name: this.data.mode === 'edit' ? this.data.activity.name : '',
  });

  protected readonly activityForm = form(this.model, (path) => {
    required(path.name, { message: ACTIVITY_NAME_REQUIRED });
    validate(path.name, ({ value }) =>
      value() !== '' && value().trim() === ''
        ? { kind: 'required', message: ACTIVITY_NAME_REQUIRED }
        : undefined,
    );
  });

  protected onSubmit(): Promise<boolean> {
    return submit(this.activityForm, async () => {
      try {
        const { name } = this.model();
        await firstValueFrom(
          this.data.mode === 'create'
            ? this.gateway.register(name)
            : this.gateway.rename(this.data.activity.id, name),
        );
        this.dialogRef.close(true);
        return undefined;
      } catch (error) {
        return mapMaintenanceActivityFormError(error, this.activityForm);
      }
    });
  }
}
