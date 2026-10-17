import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { form, FormField, required, submit } from '@angular/forms/signals';
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

import {
  AppComponent as AppComponentRecord,
  ComponentsGateway,
} from '../../core/components/components-gateway';
import { mapComponentFormError, ComponentFormModel } from './server-errors';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';

export type ComponentFormDialogData =
  { readonly mode: 'create' } | { readonly mode: 'edit'; readonly component: AppComponentRecord };

@Component({
  selector: 'app-component-form-dialog',
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
      [heading]="data.mode === 'create' ? 'افزودن جز' : 'ویرایش ' + data.component.name"
      subtitle="فیلدهای ستاره‌دار الزامی است."
    />

    <form novalidate (submit)="onSubmit(); $event.preventDefault()">
      <mat-dialog-content class="stack">
        <!-- A failure that belongs to no single field, at the top of the content. -->
        @if (componentForm().errors().length) {
          <app-error-banner [message]="componentForm().errors()[0].message ?? ''" />
        }

        <mat-form-field appearance="outline">
          <mat-label>اسم جز</mat-label>
          <input matInput [formField]="componentForm.name" autocomplete="off" />
          @if (componentForm.name().touched() && componentForm.name().errors().length) {
            <mat-error>{{ componentForm.name().errors()[0].message }}</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions class="dialog-footer">
        <button matButton type="button" mat-dialog-close>انصراف</button>
        <button matButton="filled" type="submit" [disabled]="componentForm().submitting()">
          ثبت جز
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styleUrl: './component-form-dialog.scss',
})
export class ComponentFormDialog {
  private readonly dialogRef = inject(MatDialogRef<ComponentFormDialog, boolean>);
  protected readonly data = inject<ComponentFormDialogData>(MAT_DIALOG_DATA);
  private readonly componentsGateway = inject(ComponentsGateway);

  private readonly initial = this.data.mode === 'edit' ? this.data.component : undefined;

  private readonly model = signal<ComponentFormModel>({
    name: this.initial?.name ?? '',
  });

  protected readonly componentForm = form(this.model, (path) => {
    required(path.name, { message: 'نام را وارد کنید.' });
  });

  protected onSubmit(): Promise<boolean> {
    return submit(this.componentForm, async () => {
      try {
        if (this.data.mode === 'create') {
          await firstValueFrom(this.componentsGateway.register(this.model()));
        } else {
          await firstValueFrom(this.componentsGateway.update(this.data.component.id, this.model()));
        }

        this.dialogRef.close(true);
        return undefined;
      } catch (error) {
        return mapComponentFormError(error, this.componentForm);
      }
    });
  }
}
