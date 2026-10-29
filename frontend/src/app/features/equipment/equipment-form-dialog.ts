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
import { firstValueFrom } from 'rxjs';

import { AppEquipment, EquipmentGateway } from '../../core/maintenance/equipment-gateway';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import {
  EQUIPMENT_NAME_REQUIRED,
  EquipmentFormModel,
  mapEquipmentFormError,
} from './server-errors';

export type EquipmentFormDialogData =
  { readonly mode: 'create' } | { readonly mode: 'edit'; readonly equipment: AppEquipment };

/** Registers a piece of equipment by name, or renames one — the name is all equipment has. */
@Component({
  selector: 'app-equipment-form-dialog',
  imports: [
    DialogHead,
    ErrorBanner,
    FormField,
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatError,
    MatFormField,
    MatInput,
    MatLabel,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-head
      [heading]="data.mode === 'create' ? 'افزودن تجهیز' : 'ویرایش تجهیز'"
      [subtitle]="data.mode === 'create' ? 'فیلدهای ستاره‌دار الزامی است.' : data.equipment.name"
    />

    <form novalidate (submit)="onSubmit(); $event.preventDefault()">
      <mat-dialog-content class="stack">
        @if (equipmentForm().errors().length) {
          <app-error-banner [message]="equipmentForm().errors()[0].message ?? ''" />
        }

        <mat-form-field appearance="outline">
          <mat-label>نام تجهیز</mat-label>
          <input matInput [formField]="equipmentForm.name" autocomplete="off" />
          @if (equipmentForm.name().touched() && equipmentForm.name().errors().length) {
            <mat-error>{{ equipmentForm.name().errors()[0].message }}</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions class="dialog-footer">
        <button matButton type="button" mat-dialog-close>انصراف</button>
        <button matButton="filled" type="submit" [disabled]="equipmentForm().submitting()">
          ثبت تجهیز
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styleUrl: './equipment-form-dialog.scss',
})
export class EquipmentFormDialog {
  private readonly dialogRef = inject(MatDialogRef<EquipmentFormDialog, boolean>);
  protected readonly data = inject<EquipmentFormDialogData>(MAT_DIALOG_DATA);
  private readonly gateway = inject(EquipmentGateway);

  private readonly model = signal<EquipmentFormModel>({
    name: this.data.mode === 'edit' ? this.data.equipment.name : '',
  });

  protected readonly equipmentForm = form(this.model, (path) => {
    required(path.name, { message: EQUIPMENT_NAME_REQUIRED });
    // The API trims the name before judging it, so a run of spaces is as blank as an empty box.
    validate(path.name, ({ value }) =>
      value() !== '' && value().trim() === ''
        ? { kind: 'required', message: EQUIPMENT_NAME_REQUIRED }
        : undefined,
    );
  });

  protected onSubmit(): Promise<boolean> {
    return submit(this.equipmentForm, async () => {
      try {
        const { name } = this.model();
        await firstValueFrom(
          this.data.mode === 'create'
            ? this.gateway.register(name)
            : this.gateway.rename(this.data.equipment.id, name),
        );
        this.dialogRef.close(true);
        return undefined;
      } catch (error) {
        return mapEquipmentFormError(error, this.equipmentForm);
      }
    });
  }
}
