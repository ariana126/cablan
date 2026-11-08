import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { disabled, form, FormField, required, submit, validate } from '@angular/forms/signals';
import {
  MatAutocomplete,
  MatAutocompleteSelectedEvent,
  MatAutocompleteTrigger,
} from '@angular/material/autocomplete';
import { MatButton } from '@angular/material/button';
import { MatChipGrid, MatChipInput, MatChipRemove, MatChipRow } from '@angular/material/chips';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatOption } from '@angular/material/select';
import { firstValueFrom } from 'rxjs';

import { AppOrder, OrdersGateway } from '../../core/orders/orders-gateway';
import {
  CorrectionConfirmation,
  withCorrection,
} from '../../ui/correction-confirmation/correction-confirmation';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { Icon } from '../../ui/icon/icon';
import { MiCodeOption, miCodeOptionLabel, offeredMiCodes } from './mi-code-option';
import {
  MI_CODES_REQUIRED,
  mapOrderFormError,
  ORDER_NUMBER_REQUIRED,
  OrderFormModel,
} from './server-errors';

/** `miCodeOptions` are what «کدهای MI» offers: every MI code there is, with its product. */
export type OrderFormDialogData =
  | { readonly mode: 'create'; readonly miCodeOptions: readonly MiCodeOption[] }
  | {
      readonly mode: 'edit';
      readonly order: AppOrder;
      readonly miCodeOptions: readonly MiCodeOption[];
    };

/** Why the MI codes of an order in use can't be changed — the field's hint while they are locked. */
export const MI_CODES_LOCKED_HINT =
  'این سفارش در آنالیز روزانه ثبت شده است؛ فقط شمارهٔ آن را می‌توان اصلاح کرد.';

/**
 * «تعریف سفارش» and «ویرایش»: an order's number and the MI codes assigned to it (issue #101). An edit
 * sends the number and the **whole** list, which replaces the order's.
 *
 * «کدهای MI» is a chip grid fed by an autocomplete (issue #111): typing narrows the offer by code or
 * product name, a picked code becomes a chip («برداشتن <code>» takes it back), and a code already
 * chosen is never offered again.
 *
 * An order with daily BOMs can't be edited (issue #94's 409, shown here). The System Admin's one
 * exception is renumbering it: an edit that leaves the MI codes as they were is a correction, so
 * the refusal opens the shared correction confirmation and «تایید» re-sends it with
 * `applyToRelatedRecords` — carried into every daily BOM of the order. Only the System Admin reaches
 * this form for such an order (the page disables «ویرایش» for anyone else), so its MI codes are
 * locked here, with a hint, rather than left to be refused.
 */
@Component({
  selector: 'app-order-form-dialog',
  imports: [
    DialogHead,
    ErrorBanner,
    FormField,
    Icon,
    MatAutocomplete,
    MatAutocompleteTrigger,
    MatButton,
    MatChipGrid,
    MatChipInput,
    MatChipRemove,
    MatChipRow,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatError,
    MatFormField,
    MatHint,
    MatIcon,
    MatInput,
    MatLabel,
    MatOption,
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

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>کدهای MI</mat-label>
          <mat-chip-grid #chipGrid [formField]="orderForm.miCodes">
            @for (miCode of model().miCodes; track miCode) {
              <mat-chip-row [value]="miCode" [removable]="!locksMiCodes" (removed)="remove(miCode)">
                <bdi>{{ chipLabel(miCode) }}</bdi>
                @if (!locksMiCodes) {
                  <button matChipRemove type="button" [attr.aria-label]="'برداشتن ' + miCode">
                    <mat-icon appIcon="close" />
                  </button>
                }
              </mat-chip-row>
            }
            <input
              #miCodeInput
              autocomplete="off"
              [matChipInputFor]="chipGrid"
              [matAutocomplete]="miCodeOptions"
              (input)="query.set(miCodeInput.value)"
            />
          </mat-chip-grid>
          <mat-autocomplete #miCodeOptions="matAutocomplete" (optionSelected)="add($event)">
            @for (option of offered(); track option.miCode) {
              <mat-option [value]="option.miCode">{{ optionLabel(option) }}</mat-option>
            }
          </mat-autocomplete>
          @if (locksMiCodes) {
            <mat-hint>{{ lockedHint }}</mat-hint>
          }
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

  private readonly miCodeInput = viewChild.required<ElementRef<HTMLInputElement>>('miCodeInput');

  protected readonly optionLabel = miCodeOptionLabel;
  protected readonly lockedHint = MI_CODES_LOCKED_HINT;

  protected readonly heading =
    this.data.mode === 'create' ? 'تعریف سفارش' : `ویرایش سفارش ${this.data.order.orderNumber}`;

  /** An order with daily BOMs keeps its MI codes; only its number may be corrected. */
  protected readonly locksMiCodes = this.data.mode === 'edit' && this.data.order.dailyBomCount > 0;

  private readonly initialMiCodes =
    this.data.mode === 'edit' ? this.data.order.miCodes.map((code) => code.miCode) : [];

  /** Each code's option, the order's own codes included, so every chip reads «code — product». */
  private readonly optionsByCode = new Map<string, MiCodeOption>([
    ...(this.data.mode === 'edit' ? this.data.order.miCodes : []).map(
      (code) => [code.miCode, { miCode: code.miCode, productName: code.productName }] as const,
    ),
    ...this.data.miCodeOptions.map((option) => [option.miCode, option] as const),
  ]);

  protected readonly model = signal<OrderFormModel>({
    orderNumber: this.data.mode === 'edit' ? this.data.order.orderNumber : '',
    miCodes: [...this.initialMiCodes],
  });

  /** What is typed in the autocomplete — a search, never a value of the form. */
  protected readonly query = signal('');

  protected readonly offered = computed(() =>
    offeredMiCodes(this.data.miCodeOptions, this.query(), this.model().miCodes),
  );

  protected readonly orderForm = form(this.model, (path) => {
    // `required` also stars both labels. The API trims the number before it judges it, so a run of
    // spaces is as blank as an empty box.
    required(path.orderNumber, { message: ORDER_NUMBER_REQUIRED });
    validate(path.orderNumber, ({ value }) =>
      value() !== '' && value().trim() === ''
        ? { kind: 'required', message: ORDER_NUMBER_REQUIRED }
        : undefined,
    );
    // `required` stars the chip grid but counts an empty list as a value, so that is checked apart.
    required(path.miCodes, { message: MI_CODES_REQUIRED });
    validate(path.miCodes, ({ value }) =>
      value().length === 0 ? { kind: 'required', message: MI_CODES_REQUIRED } : undefined,
    );
    if (this.locksMiCodes) {
      disabled(path.miCodes);
    }
  });

  protected chipLabel(miCode: string): string {
    return miCodeOptionLabel(this.optionsByCode.get(miCode) ?? { miCode, productName: '' });
  }

  protected add(event: MatAutocompleteSelectedEvent): void {
    const miCode = event.option.value as string;
    this.model.update((model) => ({ ...model, miCodes: [...model.miCodes, miCode] }));
    // The autocomplete writes the picked value into the input; the chip now says it instead.
    this.miCodeInput().nativeElement.value = '';
    this.query.set('');
  }

  protected remove(miCode: string): void {
    this.model.update((model) => ({
      ...model,
      miCodes: model.miCodes.filter((code) => code !== miCode),
    }));
  }

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
