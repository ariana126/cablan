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
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
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
    MatHint,
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

        <mat-form-field appearance="outline">
          <mat-label>کد مواد اولیه</mat-label>
          <input matInput [formField]="materialForm.code" autocomplete="off" />
          <mat-hint>اختیاری</mat-hint>
          @if (materialForm.code().touched() && materialForm.code().errors().length) {
            <mat-error>{{ materialForm.code().errors()[0].message }}</mat-error>
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
    code: this.initial?.code ?? '',
  });

  protected readonly materialForm = form(this.model, (path) => {
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

/**
 * The wire shape for both register and edit. The code is always sent — on an edit that is what lets
 * an emptied field clear it — and a blank one goes out as `null`, the API's "no code".
 */
function toMaterialDto(model: MaterialFormModel): { name: string; code: string | null } {
  const code = model.code.trim();
  return { name: model.name, code: code === '' ? null : code };
}
