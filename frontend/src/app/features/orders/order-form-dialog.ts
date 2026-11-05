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
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { firstValueFrom } from 'rxjs';

import { AppOrder, OrdersGateway } from '../../core/orders/orders-gateway';
import { AppStandardBom } from '../../core/standard-boms/standard-boms-gateway';
import {
  CorrectionConfirmation,
  withCorrection,
} from '../../ui/correction-confirmation/correction-confirmation';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { Icon } from '../../ui/icon/icon';
import {
  MI_CODES_REQUIRED,
  mapOrderFormError,
  ORDER_NUMBER_REQUIRED,
  OrderFormModel,
} from './server-errors';
import { miCodeOptionLabel } from './mi-code-option';

/** `standardBoms` are what «کدهای MI» offers: every standard BOM, by MI code. */
export type OrderFormDialogData =
  | { readonly mode: 'create'; readonly standardBoms: readonly AppStandardBom[] }
  | {
      readonly mode: 'edit';
      readonly order: AppOrder;
      readonly standardBoms: readonly AppStandardBom[];
    };

/**
 * «تعریف سفارش» and «ویرایش»: an order's number and the MI codes assigned to it (issue #101). An edit
 * sends the number and the **whole** list, which replaces the order's.
 *
 * An order with daily BOMs can't be edited (issue #94's 409, shown here). The System Admin's one
 * exception is renumbering it: an edit that leaves the MI codes as they were is a correction, so
 * the refusal opens the shared correction confirmation and «تایید» re-sends it with
 * `applyToRelatedRecords` — carried into every daily BOM of the order. Changing the MI codes of an
 * order in use is never a correction.
 */
@Component({
  selector: 'app-order-form-dialog',
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
    MatOption,
    MatSelect,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-head [heading]="heading" subtitle="فیلدهای ستاره‌دار الزامی است." />

    <form novalidate (submit)="onSubmit(); $event.preventDefault()">
      <mat-dialog-content class="stack">
        @if (orderForm().errors().length) {
          <app-error-banner [message]="orderForm().errors()[0].message ?? ''" />
        }

        <mat-form-field appearance="outline">
          <mat-label>شماره سفارش</mat-label>
          <input matInput [formField]="orderForm.orderNumber" autocomplete="off" />
          @if (orderForm.orderNumber().touched() && orderForm.orderNumber().errors().length) {
            <mat-error>{{ orderForm.orderNumber().errors()[0].message }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>کدهای MI</mat-label>
          <mat-select multiple [formField]="orderForm.miCodes">
            @for (standardBom of data.standardBoms; track standardBom.id) {
              <mat-option [value]="standardBom.miCode">{{ optionLabel(standardBom) }}</mat-option>
            }
          </mat-select>
          @if (orderForm.miCodes().touched() && orderForm.miCodes().errors().length) {
            <mat-error>{{ orderForm.miCodes().errors()[0].message }}</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions class="dialog-footer">
        <button matButton type="button" mat-dialog-close>
          <mat-icon appIcon="cancel" />انصراف
        </button>
        <button matButton="filled" type="submit" [disabled]="orderForm().submitting()">
          <mat-icon appIcon="check" />ثبت
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styleUrl: './order-form-dialog.scss',
})
export class OrderFormDialog {
  private readonly dialogRef = inject(MatDialogRef<OrderFormDialog, boolean>);
  protected readonly data = inject<OrderFormDialogData>(MAT_DIALOG_DATA);
  private readonly ordersGateway = inject(OrdersGateway);
  private readonly correction = inject(CorrectionConfirmation);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly optionLabel = miCodeOptionLabel;

  protected readonly heading =
    this.data.mode === 'create' ? 'تعریف سفارش' : `ویرایش سفارش ${this.data.order.orderNumber}`;

  private readonly initialMiCodes =
    this.data.mode === 'edit' ? this.data.order.miCodes.map((code) => code.miCode) : [];

  private readonly model = signal<OrderFormModel>({
    orderNumber: this.data.mode === 'edit' ? this.data.order.orderNumber : '',
    miCodes: [...this.initialMiCodes],
  });

  protected readonly orderForm = form(this.model, (path) => {
    // `required` also stars both labels. The API trims the number before it judges it, so a run of
    // spaces is as blank as an empty box.
    required(path.orderNumber, { message: ORDER_NUMBER_REQUIRED });
    validate(path.orderNumber, ({ value }) =>
      value() !== '' && value().trim() === ''
        ? { kind: 'required', message: ORDER_NUMBER_REQUIRED }
        : undefined,
    );
    // `required` stars the select but counts an empty list as a value, so that is checked apart.
    required(path.miCodes, { message: MI_CODES_REQUIRED });
    validate(path.miCodes, ({ value }) =>
      value().length === 0 ? { kind: 'required', message: MI_CODES_REQUIRED } : undefined,
    );
  });

  protected onSubmit(): Promise<boolean> {
    return submit(this.orderForm, async () => {
      const body = {
        orderNumber: this.model().orderNumber.trim(),
        miCodes: this.model().miCodes,
      };
      try {
        if (this.data.mode === 'create') {
          await firstValueFrom(this.ordersGateway.define(body));
        } else {
          const { id } = this.data.order;
          const outcome = await this.correction.save(
            (applyToRelatedRecords) =>
              this.ordersGateway.update(id, withCorrection(body, applyToRelatedRecords)),
            sameCodes(body.miCodes, this.initialMiCodes),
            this.host.nativeElement.querySelector('input'),
          );
          if (outcome === 'declined') {
            return undefined;
          }
        }
        this.dialogRef.close(true);
        return undefined;
      } catch (error) {
        return mapOrderFormError(error, this.orderForm);
      }
    });
  }
}

/** Whether two MI code lists hold the same codes — only the number changed, a correction. */
function sameCodes(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((code) => b.includes(code));
}
