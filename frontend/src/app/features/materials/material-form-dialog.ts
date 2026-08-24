import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { form, FormField, required, submit } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { firstValueFrom } from 'rxjs';

import { AppMaterial, MaterialsGateway } from '../../core/materials/materials-gateway';
import { mapMaterialFormError, MaterialFormModel } from './server-errors';

export type MaterialFormDialogData =
  { readonly mode: 'create' } | { readonly mode: 'edit'; readonly material: AppMaterial };

@Component({
  selector: 'app-material-form-dialog',
  imports: [
    FormField,
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatError,
    MatFormField,
    MatInput,
    MatLabel,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>
      @if (data.mode === 'create') {
        افزودن مواد اولیه
      } @else {
        ویرایش {{ data.material.name }}
      }
    </h2>

    <form novalidate (submit)="onSubmit(); $event.preventDefault()">
      <mat-dialog-content class="stack">
        @if (materialForm().errors().length) {
          <p class="form-error" role="alert">{{ materialForm().errors()[0].message }}</p>
        }

        <mat-form-field appearance="outline">
          <mat-label>اسم مواد اولیه</mat-label>
          <input matInput [formField]="materialForm.name" autocomplete="off" />
          @if (materialForm.name().touched() && materialForm.name().errors().length) {
            <mat-error>{{ materialForm.name().errors()[0].message }}</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>انصراف</button>
        <button matButton="filled" type="submit" [disabled]="materialForm().submitting()">
          ثبت
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
  });

  protected readonly materialForm = form(this.model, (path) => {
    required(path.name, { message: 'نام را وارد کنید.' });
  });

  protected onSubmit(): Promise<boolean> {
    return submit(this.materialForm, async () => {
      try {
        if (this.data.mode === 'create') {
          await firstValueFrom(this.materialsGateway.register(this.model()));
        } else {
          await firstValueFrom(this.materialsGateway.update(this.data.material.id, this.model()));
        }

        this.dialogRef.close(true);
        return undefined;
      } catch (error) {
        return mapMaterialFormError(error, this.materialForm);
      }
    });
  }
}
