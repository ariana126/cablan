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

import { AppMaterial, MaterialsGateway } from '../../core/materials/materials-gateway';
import { mapMaterialFormError, MaterialFormModel } from './server-errors';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';

export type MaterialFormDialogData =
  { readonly mode: 'create' } | { readonly mode: 'edit'; readonly material: AppMaterial };

@Component({
  selector: 'app-material-form-dialog',
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
      [heading]="data.mode === 'create' ? 'افزودن مواد اولیه' : 'ویرایش ' + data.material.name"
      subtitle="فیلدهای ستاره‌دار الزامی است."
    />

    <form novalidate (submit)="onSubmit(); $event.preventDefault()">
      <mat-dialog-content class="stack">
        <!-- A failure that belongs to no single field, at the top of the content. -->
        @if (materialForm().errors().length) {
          <app-error-banner [message]="materialForm().errors()[0].message ?? ''" />
        }

        <mat-form-field appearance="outline">
          <mat-label>کد مواد اولیه</mat-label>
          <input matInput [formField]="materialForm.code" autocomplete="off" />
          @if (materialForm.code().touched() && materialForm.code().errors().length) {
            <mat-error>{{ materialForm.code().errors()[0].message }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>اسم مواد اولیه</mat-label>
          <input matInput [formField]="materialForm.name" autocomplete="off" />
          @if (materialForm.name().touched() && materialForm.name().errors().length) {
            <mat-error>{{ materialForm.name().errors()[0].message }}</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions class="dialog-footer">
        <button matButton type="button" mat-dialog-close>انصراف</button>
        <button matButton="filled" type="submit" [disabled]="materialForm().submitting()">
          ثبت مواد اولیه
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styleUrl: './material-form-dialog.scss',
})
export class MaterialFormDialog {
  private readonly dialogRef = inject(MatDialogRef<MaterialFormDialog, boolean>);
  protected readonly data = inject<MaterialFormDialogData>(MAT_DIALOG_DATA);
  private readonly materialsGateway = inject(MaterialsGateway);

  private readonly initial = this.data.mode === 'edit' ? this.data.material : undefined;

  private readonly model = signal<MaterialFormModel>({
    name: this.initial?.name ?? '',
    code: this.initial?.code ?? '',
  });

  protected readonly materialForm = form(this.model, (path) => {
    required(path.code, { message: 'کد را وارد کنید.' });
    // The API trims the code before it judges it, so a run of spaces is as blank as an empty box.
    validate(path.code, ({ value }) =>
      value() !== '' && value().trim() === ''
        ? { kind: 'required', message: 'کد را وارد کنید.' }
        : undefined,
    );
    required(path.name, { message: 'نام را وارد کنید.' });
  });

  protected onSubmit(): Promise<boolean> {
    return submit(this.materialForm, async () => {
      try {
        const material = toMaterialDto(this.model());
        if (this.data.mode === 'create') {
          await firstValueFrom(this.materialsGateway.register(material));
        } else {
          await firstValueFrom(this.materialsGateway.update(this.data.material.id, material));
        }

        this.dialogRef.close(true);
        return undefined;
      } catch (error) {
        return mapMaterialFormError(error, this.materialForm);
      }
    });
  }
}

/** The wire shape for both register and edit — the code is required, so it is always sent. */
function toMaterialDto(model: MaterialFormModel): { name: string; code: string } {
  return { name: model.name, code: model.code.trim() };
}
