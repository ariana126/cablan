import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { form, FormField, required, submit, validate } from '@angular/forms/signals';
import { MatAutocomplete, MatAutocompleteTrigger } from '@angular/material/autocomplete';
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
import { MatOption } from '@angular/material/select';
import { firstValueFrom } from 'rxjs';

import { toLatinDigits } from '../../core/i18n/persian-numerals';
import { AppOrder, OrdersGateway } from '../../core/orders/orders-gateway';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { Icon } from '../../ui/icon/icon';
import { MiCodeOption, miCodeOptionLabel, offeredMiCodes } from './mi-code-option';
import {
  AddMiCodeFormModel,
  mapAddMiCodeError,
  MI_CODE_NOT_OFFERED,
  MI_CODE_REQUIRED,
} from './server-errors';

export interface AddOrderMiCodeDialogData {
  readonly order: AppOrder;
  /** Every MI code there is, with its product; the dialog offers those the order lacks. */
  readonly miCodeOptions: readonly MiCodeOption[];
}

/**
 * «افزودن کد MI»: assigns one more MI code to an order — allowed even on an order with daily BOMs,
 * which it leaves untouched. It names the order and lists the codes it holds, then offers the others
 * in an autocomplete «کد MI» searchable by code or product (issue #111). What is typed must end up
 * one of those codes — picked, or typed whole; one assigned meanwhile is the API's 409, shown on
 * the field.
 */
@Component({
  selector: 'app-add-order-mi-code-dialog',
  imports: [
    DialogHead,
    ErrorBanner,
    FormField,
    Icon,
    MatAutocomplete,
    MatAutocompleteTrigger,
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatError,
    MatFormField,
    MatIcon,
    MatInput,
    MatLabel,
    MatOption,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-head heading="افزودن کد MI" [subtitle]="'سفارش ' + data.order.orderNumber" />

    <form novalidate (submit)="onSubmit(); $event.preventDefault()">
      <mat-dialog-content class="stack">
        @if (addForm().errors().length) {
          <app-error-banner [message]="addForm().errors()[0].message ?? ''" />
        }

        <div class="assigned">
          <h3 class="assigned__title" [id]="assignedHeadingId">کدهای فعلی این سفارش</h3>
          <ul class="assigned-codes" [attr.aria-labelledby]="assignedHeadingId">
            @for (code of data.order.miCodes; track code.standardBomId) {
              <li>
                <bdi class="cell-id">{{ code.miCode }}</bdi
                >&ngsp;
                <span class="assigned-codes__product">{{ code.productName }}</span>
              </li>
            }
          </ul>
        </div>

        @if (unassigned.length === 0) {
          <p>همهٔ کدهای MI به این سفارش تخصیص داده شده‌اند.</p>
        }

        <mat-form-field appearance="outline">
          <mat-label>کد MI</mat-label>
          <input
            matInput
            autocomplete="off"
            [formField]="addForm.miCode"
            [matAutocomplete]="miCodes"
          />
          <mat-autocomplete #miCodes="matAutocomplete">
            @for (option of offered(); track option.miCode) {
              <mat-option [value]="option.miCode">{{ optionLabel(option) }}</mat-option>
            }
          </mat-autocomplete>
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
  protected readonly assignedHeadingId = 'add-order-mi-code-assigned';

  /** Every MI code the order does not hold yet. */
  protected readonly unassigned = offeredMiCodes(
    this.data.miCodeOptions,
    '',
    this.data.order.miCodes.map((code) => code.miCode),
  );

  private readonly model = signal<AddMiCodeFormModel>({ miCode: '' });

  /** The unassigned codes matching what is typed so far. */
  protected readonly offered = computed(() =>
    offeredMiCodes(this.unassigned, this.model().miCode, []),
  );

  protected readonly addForm = form(this.model, (path) => {
    required(path.miCode, { message: MI_CODE_REQUIRED });
    validate(path.miCode, ({ value }) =>
      value() !== '' && this.chosen(value()) === undefined
        ? { kind: 'not-offered', message: MI_CODE_NOT_OFFERED }
        : undefined,
    );
  });

  /** The unassigned code the text names exactly, in whatever digits it was typed. */
  private chosen(text: string): string | undefined {
    const miCode = toLatinDigits(text.trim());
    return this.unassigned.find((option) => option.miCode === miCode)?.miCode;
  }

  protected onSubmit(): Promise<boolean> {
    return submit(this.addForm, async () => {
      try {
        const miCode = this.chosen(this.model().miCode) ?? '';
        await firstValueFrom(this.ordersGateway.addMiCode(this.data.order.id, miCode));
        this.dialogRef.close(true);
        return undefined;
      } catch (error) {
        return mapAddMiCodeError(error, this.addForm);
      }
    });
  }
}
