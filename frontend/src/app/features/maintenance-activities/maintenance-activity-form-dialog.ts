import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
import { MatRadioButton, MatRadioGroup } from '@angular/material/radio';
import { firstValueFrom } from 'rxjs';

import { ActivitySpecialty, SPECIALTY_LABELS } from '../../core/i18n/specialty-labels';
import {
  AppMaintenanceActivity,
  MaintenanceActivitiesGateway,
} from '../../core/maintenance/maintenance-activities-gateway';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import {
  ACTIVITY_NAME_REQUIRED,
  ACTIVITY_SPECIALTY_REQUIRED,
  mapMaintenanceActivityFormError,
  MaintenanceActivityFormModel,
} from './server-errors';
import { Icon } from '../../ui/icon/icon';

export type MaintenanceActivityFormDialogData =
  | { readonly mode: 'create' }
  | { readonly mode: 'edit'; readonly activity: AppMaintenanceActivity };

/** The specialties in the order the choice offers them. */
const SPECIALTY_CHOICES = (Object.keys(SPECIALTY_LABELS) as ActivitySpecialty[]).map((value) => ({
  value,
  label: SPECIALTY_LABELS[value],
}));

let nextId = 0;

/**
 * Adds an activity to the catalog, or edits its name and specialty. The specialty is a required
 * `mat-radio-group` named «تخصص» by its visible label (the asterisk sits outside the labelling
 * element, so the name is exactly «تخصص»); a missing one is told by a `mat-error` under it on
 * submit — the submit button never disables for it.
 */
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
    MatRadioButton,
    MatRadioGroup,
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

        <div class="specialty">
          <span class="specialty__label">
            <span [id]="specialtyLabelId">تخصص</span>
            <span class="specialty__required" aria-hidden="true">*</span>
          </span>
          <mat-radio-group
            [formField]="activityForm.specialty"
            [attr.aria-labelledby]="specialtyLabelId"
            aria-required="true"
            [attr.aria-invalid]="specialtyInvalid()"
            [attr.aria-describedby]="specialtyInvalid() ? specialtyErrorId : null"
            class="specialty__choices"
          >
            @for (choice of specialtyChoices; track choice.value) {
              <mat-radio-button [value]="choice.value">{{ choice.label }}</mat-radio-button>
            }
          </mat-radio-group>
          @if (specialtyInvalid()) {
            <mat-error [id]="specialtyErrorId" class="specialty__error">
              {{ activityForm.specialty().errors()[0].message }}
            </mat-error>
          }
        </div>
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

  protected readonly specialtyChoices = SPECIALTY_CHOICES;
  private readonly id = nextId++;
  protected readonly specialtyLabelId = `activity-specialty-label-${this.id}`;
  protected readonly specialtyErrorId = `activity-specialty-error-${this.id}`;

  private readonly model = signal<MaintenanceActivityFormModel>({
    name: this.data.mode === 'edit' ? this.data.activity.name : '',
    specialty: this.data.mode === 'edit' ? (this.data.activity.specialty ?? '') : '',
  });

  protected readonly activityForm = form(this.model, (path) => {
    required(path.specialty, { message: ACTIVITY_SPECIALTY_REQUIRED });
    required(path.name, { message: ACTIVITY_NAME_REQUIRED });
    validate(path.name, ({ value }) =>
      value() !== '' && value().trim() === ''
        ? { kind: 'required', message: ACTIVITY_NAME_REQUIRED }
        : undefined,
    );
  });

  protected readonly specialtyInvalid = computed(
    () =>
      this.activityForm.specialty().touched() && this.activityForm.specialty().errors().length > 0,
  );

  protected onSubmit(): Promise<boolean> {
    return submit(this.activityForm, async () => {
      try {
        const { name, specialty } = this.model();
        if (specialty === '') {
          // Unreachable: `required` stops the submit first. Narrows the type.
          return undefined;
        }
        const details = { name, specialty };
        await firstValueFrom(
          this.data.mode === 'create'
            ? this.gateway.register(details)
            : this.gateway.edit(this.data.activity.id, details),
        );
        this.dialogRef.close(true);
        return undefined;
      } catch (error) {
        return mapMaintenanceActivityFormError(error, this.activityForm);
      }
    });
  }
}
