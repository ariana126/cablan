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
import { MatIcon } from '@angular/material/icon';
import { MatOption, MatSelect } from '@angular/material/select';
import { firstValueFrom } from 'rxjs';

import { AppOrder, OrdersGateway } from '../../core/orders/orders-gateway';
import { AppStandardBom } from '../../core/standard-boms/standard-boms-gateway';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { Icon } from '../../ui/icon/icon';
import { miCodeOptionLabel } from './mi-code-option';
import { AddMiCodeFormModel, mapAddMiCodeError, MI_CODE_REQUIRED } from './server-errors';

export interface AddOrderMiCodeDialogData {
  readonly order: AppOrder;
  readonly standardBoms: readonly AppStandardBom[];
}

/**
 * «افزودن کد MI»: assigns one more MI code to an order — allowed even on an order with daily BOMs,
 * which it leaves untouched. Offers only the codes the order does not hold yet; one assigned
 * meanwhile is the API's 409, shown on the field.
 */
@Component({
  selector: 'app-add-order-mi-code-dialog',
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
    MatLabel,
    MatOption,
    MatSelect,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-head heading="افزودن کد MI" [subtitle]="'سفارش ' + data.order.orderNumber" />

    <form novalidate (submit)="onSubmit(); $event.preventDefault()">
      <mat-dialog-content class="stack">
        @if (addForm().errors().length) {
          <app-error-banner [message]="addForm().errors()[0].message ?? ''" />
        }

        @if (offered.length === 0) {
          <p>همهٔ کدهای MI به این سفارش تخصیص داده شده‌اند.</p>
        }

        <mat-form-field appearance="outline">
          <mat-label>کد MI</mat-label>
          <mat-select [formField]="addForm.miCode">
            @for (standardBom of offered; track standardBom.id) {
              <mat-option [value]="standardBom.miCode">{{ optionLabel(standardBom) }}</mat-option>
            }
          </mat-select>
          @if (addForm.miCode().touched() && addForm.miCode().errors().length) {
            <mat-error>{{ addForm.miCode().errors()[0].message }}</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions class="dialog-footer">
        <button matButton type="button" mat-dialog-close>
          <mat-icon appIcon="cancel" />انصراف
        </button>
        <button matButton="filled" type="submit" [disabled]="addForm().submitting()">
          <mat-icon appIcon="add" />افزودن
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styleUrl: './add-order-mi-code-dialog.scss',
})
export class AddOrderMiCodeDialog {
  private readonly dialogRef = inject(MatDialogRef<AddOrderMiCodeDialog, boolean>);
  protected readonly data = inject<AddOrderMiCodeDialogData>(MAT_DIALOG_DATA);
  private readonly ordersGateway = inject(OrdersGateway);

  protected readonly optionLabel = miCodeOptionLabel;

  /** Every standard BOM whose MI code the order does not hold yet. */
  protected readonly offered = this.data.standardBoms.filter(
    (standardBom) => !this.data.order.miCodes.some((code) => code.miCode === standardBom.miCode),
  );

  private readonly model = signal<AddMiCodeFormModel>({ miCode: '' });

  protected readonly addForm = form(this.model, (path) => {
    required(path.miCode, { message: MI_CODE_REQUIRED });
  });

  protected onSubmit(): Promise<boolean> {
    return submit(this.addForm, async () => {
      try {
        await firstValueFrom(this.ordersGateway.addMiCode(this.data.order.id, this.model().miCode));
        this.dialogRef.close(true);
        return undefined;
      } catch (error) {
        return mapAddMiCodeError(error, this.addForm);
      }
    });
  }
}
