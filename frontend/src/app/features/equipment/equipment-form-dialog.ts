import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
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
import { catchError, firstValueFrom, Observable, throwError } from 'rxjs';

import { PROBLEM, toProblemDetails } from '../../core/http/problem-details';
import { CurrentUserStore } from '../../core/identity/current-user-store';
import { canCorrectRecordsInUse } from '../../core/identity/permissions';
import { AppEquipment, EquipmentGateway } from '../../core/maintenance/equipment-gateway';
import { CorrectionConfirmation } from '../../ui/correction-confirmation/correction-confirmation';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import {
  EQUIPMENT_NAME_REQUIRED,
  EquipmentFormModel,
  mapEquipmentFormError,
} from './server-errors';
import { Icon } from '../../ui/icon/icon';

export type EquipmentFormDialogData =
  { readonly mode: 'create' } | { readonly mode: 'edit'; readonly equipment: AppEquipment };

/**
 * Registers a piece of equipment by name, or renames one — the name is all equipment has. A rename
 * of equipment whose plan or history names it is refused, except as the System Admin's correction
 * (issue #110): `CorrectionConfirmation` asks them, and the name then reaches the plan and the
 * history. The System Admin may rename retired equipment too, which stays retired.
 */
@Component({
  selector: 'app-equipment-form-dialog',
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
        <button matButton type="button" mat-dialog-close>
          <mat-icon appIcon="cancel" />انصراف
        </button>
        <button matButton="filled" type="submit" [disabled]="equipmentForm().submitting()">
          <mat-icon appIcon="check" />
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
  private readonly correction = inject(CorrectionConfirmation);
  private readonly currentUser = inject(CurrentUserStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

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
        if (this.data.mode === 'create') {
          await firstValueFrom(this.gateway.register(name));
        } else {
          const { id } = this.data.equipment;
          // The name is the only field, so every rename is a correctable one.
          const outcome = await this.correction.save(
            (applyToRelatedRecords) => this.renameRetiredToo(id, name, applyToRelatedRecords),
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
        return mapEquipmentFormError(error, this.equipmentForm);
      }
    });
  }

  /**
   * Retired equipment nothing references is refused as `equipment-retired`, not as in use, so there
   * is nothing to confirm: for the System Admin the rename goes again as a correction, which may
   * rename retired equipment. Everyone else keeps the refusal.
   */
  private renameRetiredToo(
    id: string,
    name: string,
    applyToRelatedRecords: boolean,
  ): Observable<void> {
    return this.gateway
      .rename(id, name, applyToRelatedRecords)
      .pipe(
        catchError((error: unknown) =>
          !applyToRelatedRecords &&
          toProblemDetails(error)?.type === PROBLEM.equipmentRetired &&
          canCorrectRecordsInUse(this.currentUser.role())
            ? this.gateway.rename(id, name, true)
            : throwError(() => error),
        ),
      );
  }
}
