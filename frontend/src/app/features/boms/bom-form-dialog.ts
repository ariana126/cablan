import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  applyEach,
  disabled,
  form,
  FormField,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
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
import { MatOption, MatSelect } from '@angular/material/select';
import {
  catchError,
  concat,
  debounceTime,
  distinctUntilChanged,
  firstValueFrom,
  map,
  merge,
  Observable,
  of,
  startWith,
  Subject,
  switchMap,
} from 'rxjs';

import { BomEditSource, RegisterBomDto, ResampleBomDto, UpdateBomDto } from '../../api/model';
import { AppBom, BomsGateway } from '../../core/boms/boms-gateway';
import { positiveNumber } from '../../core/forms/positive-number';
import { toLatinDigits } from '../../core/i18n/persian-numerals';
import { AppOrder, OrdersGateway } from '../../core/orders/orders-gateway';
import { AppProduct } from '../../core/products/products-gateway';
import { AppStandardBom } from '../../core/standard-boms/standard-boms-gateway';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import {
  BomComponentLineFormModel,
  BomFormModel,
  mapBomFormError,
  MI_CODE_REQUIRED,
  ORDER_FIRST,
} from './server-errors';
import { Icon } from '../../ui/icon/icon';

/** The rejected daily BOM a re-sampling starts from: what the new one inherits, unchangeable. A
 * report row (`AppBomReportRow`) already is one, so the list needs no `GET /boms/:id` first. */
export interface BomResampleSource {
  readonly id: string;
  readonly orderNumber: string;
  readonly trackingNumber: string;
  readonly standardBomMiCode: string;
}

/** `products` is there only to name the chosen standard BOM's product — a standard BOM carries
 * its `productId`, never the product's name. */
export type BomFormDialogData =
  | {
      readonly mode: 'create';
      readonly standardBoms: readonly AppStandardBom[];
      readonly products: readonly AppProduct[];
    }
  | {
      readonly mode: 'edit';
      readonly bom: AppBom;
      readonly standardBoms: readonly AppStandardBom[];
      readonly products: readonly AppProduct[];
    }
  | {
      readonly mode: 'resample';
      readonly source: BomResampleSource;
      readonly standardBoms: readonly AppStandardBom[];
      readonly products: readonly AppProduct[];
    };

/**
 * A daily BOM's composition is never freely typed: every component/material line is cloned from a
 * standard BOM's own *current* composition, and the backend does the actual cloning server-side
 * (see `backend/src/modules/boms/CLAUDE.md`). This form's only job on a composition line is
 * collecting its `weight`; `componentId`/`materialId`/`name` travel along for display and for the
 * payload, never through an editable field. Unlike a Standard BOM's product — locked once
 * registered — the referenced standard BOM stays editable here: `UpdateBomDto.standardBomMiCode`
 * is a real, independently settable field, so re-picking it re-clones the composition the same way
 * choosing one does on create.
 *
 * **The order comes first (issue #101).** A daily BOM is registered for a defined order, with one of
 * its MI codes: «شماره سفارش» is looked up (`GET /orders/by-number/…`) when the field is left and
 * 400ms after typing pauses, and «کد MI» offers only that order's codes — chosen for the visitor
 * when there is one, required when there are several. An undefined order is said in the form. In
 * edit mode «کد MI» offers only the order's codes of the daily BOM's own product, and another code
 * reloads the composition keeping the weights of the lines both share; a changed order number is
 * looked up again but never changes the MI code by itself — the API judges the pair.
 *
 * **Edit mode asks why («دلیل ویرایش», issue #73)** — the row's «ویرایش» and the post-registration
 * preview's alike — and sends it with `editSource: 'dailyBoms'`. It is never required client-side:
 * a save that changes nothing goes through without one, and an edit that does change something
 * without one is refused by the API (`edit-reason-required`), shown on that field.
 *
 * **Resample mode («نمونه گیری مجدد»)** registers a new daily BOM from a rejected one: its order
 * number, tracking number and MI code are shown filled in and disabled (the API takes them from the
 * source, so the request does not even carry them), the composition is that standard BOM's current
 * one with every weight empty — a fresh sample is a fresh measurement — and the description starts
 * empty. The MI code is a plain disabled input there, and nothing is looked up. Validation and
 * error display are registration's.
 */
@Component({
  selector: 'app-bom-form-dialog',
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
        <!-- A failure that belongs to no single field, at the top of the content. -->
        @if (submitAttempted() && bomForm().errors().length) {
          <app-error-banner [message]="bomForm().errors()[0].message ?? ''" />
        }

        <!-- The order leads the form and decides what «کد MI» offers, so it has a row of its own.
             Half-width, its unfloated label (asterisk included) reached the input's centre while it
             was empty, and the point a pointer aims at hit the label instead (issue #101). -->
        <mat-form-field appearance="outline">
          <mat-label>شماره سفارش</mat-label>
          <input
            matInput
            [formField]="bomForm.orderNumber"
            autocomplete="off"
            (blur)="orderNumberLeft.next()"
          />
          @if (bomForm.orderNumber().touched() && bomForm.orderNumber().errors().length) {
            <mat-error>{{ bomForm.orderNumber().errors()[0].message }}</mat-error>
          }
        </mat-form-field>

        @if (undefinedOrderNumber(); as orderNumber) {
          <app-error-banner
            [message]="
              'سفارشی با شماره «' +
              orderNumber +
              '» تعریف نشده است. ابتدا آن را در صفحهٔ سفارشات تعریف کنید.'
            "
          />
        }

        <!-- «کد MI» and «شماره ردیابی» share a row: both have short labels, which stay clear of the
             input's centre at half width, and the saved row keeps a one-material registration
             inside the dialog at 1280×720 — typing its weight must not scroll «شماره سفارش» out of
             view (issue #101). The order number keeps a row of its own; its label is longer. -->
        <div class="field-row">
          @if (data.mode === 'resample') {
            <mat-form-field appearance="outline">
              <mat-label>کد MI</mat-label>
              <input matInput [formField]="bomForm.standardBomMiCode" />
            </mat-form-field>
          } @else {
            <mat-form-field appearance="outline">
              <mat-label>کد MI</mat-label>
              <mat-select
                [formField]="bomForm.standardBomMiCode"
                (selectionChange)="onStandardBomChange($event.value)"
              >
                @for (option of miCodeOptions(); track option.value) {
                  <mat-option [value]="option.value">{{ option.label }}</mat-option>
                }
              </mat-select>
              @if (
                bomForm.standardBomMiCode().touched() && bomForm.standardBomMiCode().errors().length
              ) {
                <mat-error>{{ bomForm.standardBomMiCode().errors()[0].message }}</mat-error>
              }
            </mat-form-field>
          }

          <mat-form-field appearance="outline">
            <mat-label>شماره ردیابی</mat-label>
            <input matInput [formField]="bomForm.trackingNumber" autocomplete="off" />
            @if (bomForm.trackingNumber().touched() && bomForm.trackingNumber().errors().length) {
              <mat-error>{{ bomForm.trackingNumber().errors()[0].message }}</mat-error>
            }
          </mat-form-field>
        </div>

        @if (productName(); as name) {
          <mat-form-field appearance="outline">
            <mat-label>نام محصول</mat-label>
            <input matInput readonly [value]="name" />
          </mat-form-field>
        }

        <mat-form-field appearance="outline">
          <mat-label>توضیحات</mat-label>
          <textarea matInput [formField]="bomForm.description"></textarea>
        </mat-form-field>

        <!-- Edit only. Not required here: a save that changes nothing needs no reason, and only the
             API can tell — it answers edit-reason-required, shown on this field. -->
        @if (data.mode === 'edit') {
          <mat-form-field appearance="outline">
            <mat-label>دلیل ویرایش</mat-label>
            <textarea matInput rows="2" [formField]="bomForm.editReason"></textarea>
            @if (bomForm.editReason().touched() && bomForm.editReason().errors().length) {
              <mat-error>{{ bomForm.editReason().errors()[0].message }}</mat-error>
            }
          </mat-form-field>
        }

        @if (bomForm.components.length === 0) {
          @if (data.mode === 'resample') {
            <p>آنالیز استاندارد این آنالیز روزانه یافت نشد. فهرست را تازه‌سازی کنید.</p>
          } @else {
            <p>ابتدا شماره سفارش را وارد و کد MI را انتخاب کنید تا اجزای آن نمایش داده شود.</p>
          }
        } @else {
          <div class="components stack--tight">
            @for (component of bomForm.components; track $index) {
              <fieldset
                class="component-row"
                role="group"
                [attr.aria-label]="'جز ' + component().value().name"
              >
                <legend>{{ component().value().name }}</legend>

                <div class="materials stack--tight">
                  @for (material of component.materials; track $index) {
                    <mat-form-field appearance="outline">
                      <mat-label>وزن «{{ material().value().name }}» (گرم)</mat-label>
                      <input matInput type="number" step="any" [formField]="material.weight" />
                      @if (material.weight().touched() && material.weight().errors().length) {
                        <mat-error>{{ material.weight().errors()[0].message }}</mat-error>
                      }
                    </mat-form-field>
                  }
                </div>
              </fieldset>
            }
          </div>
        }
      </mat-dialog-content>

      <mat-dialog-actions class="dialog-footer">
        <button matButton type="button" mat-dialog-close>
          <mat-icon appIcon="cancel" />انصراف
        </button>
        <button matButton="filled" type="submit" [disabled]="bomForm().submitting()">
          <mat-icon appIcon="check" />
          ثبت آنالیز
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styleUrl: './bom-form-dialog.scss',
})
export class BomFormDialog {
  /** Closes with the saved daily BOM's id — the new one on create — or with nothing on cancel. */
  private readonly dialogRef = inject(MatDialogRef<BomFormDialog, string>);
  protected readonly data = inject<BomFormDialogData>(MAT_DIALOG_DATA);
  private readonly bomsGateway = inject(BomsGateway);
  private readonly ordersGateway = inject(OrdersGateway);

  protected readonly heading = headingFor(this.data);

  private readonly initial = this.data.mode === 'edit' ? this.data.bom : undefined;

  /** The standard BOM referenced by an already-registered daily BOM is known to the API only by
   * id (`standardBomId`); the form works in MI codes, so the initial selection is resolved from
   * the same `standardBoms` list the picker itself renders from. */
  private readonly initialStandardBomMiCode =
    this.data.mode === 'edit'
      ? (this.data.standardBoms.find(
          (standardBom) => standardBom.id === this.initial?.standardBomId,
        )?.miCode ?? '')
      : '';

  private readonly model = signal<BomFormModel>(
    this.data.mode === 'resample'
      ? resampleModel(this.data.source, this.data.standardBoms)
      : {
          standardBomMiCode: this.initialStandardBomMiCode,
          orderNumber: this.initial?.orderNumber ?? '',
          trackingNumber: this.initial?.trackingNumber ?? '',
          description: this.initial?.description ?? '',
          editReason: '',
          components: this.initial ? componentsFromBom(this.initial) : [],
        },
  );

  protected readonly bomForm = form(this.model, (path) => {
    // A re-sampling inherits these from the rejected daily BOM; they are shown, never changed.
    const inherited = () => this.data.mode === 'resample';
    // A `mat-select` with no options never opens its panel, so a click that lands before the order
    // lookup answers would be lost: «کد MI» is disabled until there are codes to offer. Edit mode
    // always lists the current code, so it stays enabled.
    disabled(path.standardBomMiCode, () => inherited() || this.miCodeOptions().length === 0);
    // A disabled field is not validated, so while «کد MI» has nothing to offer the refusal sits at
    // the form root — and says what unblocks it.
    validate(path, ({ value }) =>
      !inherited() && value().standardBomMiCode === '' && this.miCodeOptions().length === 0
        ? { kind: 'required', message: ORDER_FIRST }
        : undefined,
    );
    disabled(path.orderNumber, inherited);
    disabled(path.trackingNumber, inherited);

    required(path.standardBomMiCode, { message: MI_CODE_REQUIRED });
    required(path.orderNumber, { message: 'شماره سفارش را وارد کنید.' });
    required(path.trackingNumber, { message: 'شماره ردیابی را وارد کنید.' });

    applyEach(path.components, (component) => {
      applyEach(component.materials, (material) => {
        positiveNumber(material.weight, {
          message: 'وزن مواد اولیه را به صورت عدد مثبت وارد کنید.',
        });
      });
    });
  });

  /** The product the currently chosen standard BOM belongs to, or `''` until one is chosen (or
   * when its product is not in the list the dialog was given). Derived from the form model, so it
   * follows the MI code however it changes — picked, re-picked or pre-filled in edit mode. */
  protected readonly productName = computed(() => {
    const miCode = this.model().standardBomMiCode;
    const productId = this.data.standardBoms.find(
      (standardBom) => standardBom.miCode === miCode,
    )?.productId;
    return this.data.products.find((product) => product.id === productId)?.name ?? '';
  });

  /** Rebuilds the composition from the newly chosen standard BOM's *current* components and
   * materials. A line the previous composition shares (same component and material — another MI
   * code of the same product mostly shares them) keeps the weight already entered; every other
   * starts unset, since a daily BOM's weight is a fresh measurement, never cloned from the
   * standard BOM's own recorded one. */
  protected onStandardBomChange(miCode: string): void {
    const standardBom = this.data.standardBoms.find((candidate) => candidate.miCode === miCode);
    this.model.update((m) => ({
      ...m,
      standardBomMiCode: miCode,
      components: standardBom
        ? keepingWeights(componentsFromStandardBom(standardBom), m.components)
        : [],
    }));
  }

  /** Fires the lookup at once when the visitor leaves «شماره سفارش». */
  protected readonly orderNumberLeft = new Subject<void>();

  /** The typed number as the lookup sends it: trimmed, Latin digits. */
  private readonly typedOrderNumber = computed(() =>
    toLatinDigits(this.model().orderNumber.trim()),
  );

  /**
   * The order the typed number names: looked up 400ms after typing pauses, or at once when the
   * field is left; an edit form's own number as it opens. `order` is `null` when no order has the
   * number, `undefined` while that is not known (nothing typed, the answer on its way, or the
   * lookup failed — the API still judges the number on save). A re-sampling inherits its order,
   * so nothing is looked up there.
   */
  private readonly lookup = toSignal(
    this.data.mode === 'resample'
      ? of(UNKNOWN_ORDER)
      : merge(
          toObservable(this.typedOrderNumber).pipe(debounceTime(400)),
          this.orderNumberLeft.pipe(map(() => this.typedOrderNumber())),
        ).pipe(
          startWith(this.data.mode === 'edit' ? this.typedOrderNumber() : ''),
          distinctUntilChanged(),
          switchMap((orderNumber) => this.lookUp(orderNumber)),
        ),
    { initialValue: UNKNOWN_ORDER },
  );

  private lookUp(orderNumber: string): Observable<OrderLookup> {
    if (orderNumber === '') {
      return of(UNKNOWN_ORDER);
    }
    return concat(
      of(UNKNOWN_ORDER),
      this.ordersGateway.findByNumber(orderNumber).pipe(
        map((order) => ({ orderNumber, order })),
        catchError(() => of(UNKNOWN_ORDER)),
      ),
    );
  }

  private readonly order = computed(() => this.lookup().order);

  /** The number no order has, for the form to say so — `''` otherwise. */
  protected readonly undefinedOrderNumber = computed(() =>
    this.lookup().order === null ? this.lookup().orderNumber : '',
  );

  /** The daily BOM's own product, which an edit's MI code may not leave. */
  private readonly editedProductId =
    this.data.standardBoms.find((standardBom) => standardBom.id === this.initial?.standardBomId)
      ?.productId ?? '';

  /**
   * What «کد MI» offers: the order's codes — in edit mode only those of the daily BOM's product —
   * and, in edit mode, the code the daily BOM has now even when the order does not hold it (a
   * changed number), so the select never holds a value it cannot name.
   */
  protected readonly miCodeOptions = computed(() => {
    const codes = (this.order()?.miCodes ?? [])
      .filter((code) => this.data.mode !== 'edit' || code.productId === this.editedProductId)
      .map((code) => ({ miCode: code.miCode, productName: code.productName }));
    const current = this.model().standardBomMiCode;
    if (this.data.mode === 'edit' && current !== '' && !codes.some((c) => c.miCode === current)) {
      codes.unshift({ miCode: current, productName: '' });
    }
    return codes.map(({ miCode, productName }) => ({
      value: miCode,
      label: this.miCodeLabel(miCode, productName),
    }));
  });

  /** «0001 — لگراند»: the code first, then the brand that tells codes of a product apart (the
   * product's name when the standard BOM is not in the list). */
  private miCodeLabel(miCode: string, productName: string): string {
    const brand = this.data.standardBoms.find(
      (standardBom) => standardBom.miCode === miCode,
    )?.brand;
    const detail = brand || productName;
    return detail ? `${miCode} — ${detail}` : miCode;
  }

  constructor() {
    // While registering, the MI code follows the order: kept if the order holds it, else the only
    // code of a one-code order, else none (and no composition). An edit keeps its code.
    effect(() => {
      const order = this.order();
      if (this.data.mode !== 'create' || order === undefined) {
        return;
      }
      untracked(() => {
        const codes = order?.miCodes.map((code) => code.miCode) ?? [];
        const current = this.model().standardBomMiCode;
        if (current !== '' && codes.includes(current)) {
          return;
        }
        this.onStandardBomChange(codes.length === 1 ? codes[0] : '');
      });
    });
  }

  /** Root errors wait for a submit: the form's own refusal (no MI code to choose yet) would
   * otherwise show the moment «شماره سفارش» is left, while its lookup is still on its way. */
  protected readonly submitAttempted = signal(false);

  protected onSubmit(): Promise<boolean> {
    this.submitAttempted.set(true);
    return submit(this.bomForm, async () => {
      try {
        let savedId: string;
        if (this.data.mode === 'create') {
          savedId = await firstValueFrom(this.bomsGateway.register(toRegisterBomDto(this.model())));
        } else if (this.data.mode === 'resample') {
          savedId = await firstValueFrom(
            this.bomsGateway.resample(this.data.source.id, toResampleBomDto(this.model())),
          );
        } else {
          savedId = this.data.bom.id;
          await firstValueFrom(this.bomsGateway.update(savedId, toUpdateBomDto(this.model())));
        }

        this.dialogRef.close(savedId);
        return undefined;
      } catch (error) {
        return mapBomFormError(error, this.bomForm);
      }
    });
  }
}

function headingFor(data: BomFormDialogData): string {
  switch (data.mode) {
    case 'create':
      return 'ثبت آنالیز روزانه جدید';
    case 'edit':
      return 'ویرایش آنالیز روزانه ' + data.bom.orderNumber;
    case 'resample':
      return 'نمونه گیری مجدد آنالیز روزانه ' + data.source.orderNumber;
  }
}

/** The rejected daily BOM's header, and its standard BOM's *current* composition with every
 * weight unset — the same composition the API clones for the new daily BOM. */
function resampleModel(
  source: BomResampleSource,
  standardBoms: readonly AppStandardBom[],
): BomFormModel {
  const standardBom = standardBoms.find(
    (candidate) => candidate.miCode === source.standardBomMiCode,
  );
  return {
    standardBomMiCode: source.standardBomMiCode,
    orderNumber: source.orderNumber,
    trackingNumber: source.trackingNumber,
    description: '',
    editReason: '',
    // `NaN` is what an emptied number input reads back as, so the field renders blank (a `0` would
    // show as «0») and `positiveNumber` still refuses it until a weight is typed.
    components: standardBom ? componentsFromStandardBom(standardBom, Number.NaN) : [],
  };
}

function componentsFromStandardBom(
  standardBom: AppStandardBom,
  unsetWeight = 0,
): BomComponentLineFormModel[] {
  return standardBom.components.map((component) => ({
    componentId: component.id,
    name: component.name,
    materials: component.materials.map((material) => ({
      materialId: material.id,
      name: material.name,
      weight: unsetWeight,
    })),
  }));
}

/** What the order lookup knows: the number asked about and the order it names. */
interface OrderLookup {
  readonly orderNumber: string;
  readonly order: AppOrder | null | undefined;
}

const UNKNOWN_ORDER: OrderLookup = { orderNumber: '', order: undefined };

/** The new composition, with the weight already entered for each component/material line it
 * shares with the previous one — another MI code of the same product mostly shares them. */
function keepingWeights(
  next: BomComponentLineFormModel[],
  previous: readonly BomComponentLineFormModel[],
): BomComponentLineFormModel[] {
  return next.map((component) => {
    const before = previous.find((candidate) => candidate.componentId === component.componentId);
    return {
      ...component,
      materials: component.materials.map((material) => {
        const kept = before?.materials.find(
          (candidate) => candidate.materialId === material.materialId,
        );
        return kept ? { ...material, weight: kept.weight } : material;
      }),
    };
  });
}

/** Edit mode never re-clones from the live standard BOM unless its own MI code is changed — see
 * the class doc — so this reads the daily BOM's own already-cloned composition, weights included,
 * rather than `AppStandardBom`. */
function componentsFromBom(bom: AppBom): BomComponentLineFormModel[] {
  return bom.components.map((component) => ({
    componentId: component.id,
    name: component.name,
    materials: component.materials.map((material) => ({
      materialId: material.id,
      name: material.name,
      weight: material.weight,
    })),
  }));
}

function toComponentsDto(components: readonly BomComponentLineFormModel[]) {
  return components.map((component) => ({
    componentId: component.componentId,
    materials: component.materials.map((material) => ({
      materialId: material.materialId,
      weight: material.weight,
    })),
  }));
}

function toRegisterBomDto(model: BomFormModel): RegisterBomDto {
  return {
    standardBomMiCode: model.standardBomMiCode,
    orderNumber: model.orderNumber,
    trackingNumber: model.trackingNumber,
    // Sent unconditionally, unlike `standard-bom-form-dialog`'s optional-when-non-empty
    // `description` — a daily BOM's description may be cleared to empty and stay cleared (see
    // `registring-bom.feature`'s "پاک کردن توضیحات آنالیز"), so omitting an empty value here would
    // silently turn a clear into a no-op on the edit path this DTO shape is shared with.
    description: model.description,
    components: toComponentsDto(model.components),
  };
}

/** The reason travels as typed (the API trims it and judges it only when something changed); the
 * source is always this page — the post-registration preview's «ویرایش» opens this same form. */
function toUpdateBomDto(model: BomFormModel): UpdateBomDto {
  return {
    standardBomMiCode: model.standardBomMiCode,
    orderNumber: model.orderNumber,
    trackingNumber: model.trackingNumber,
    description: model.description,
    components: toComponentsDto(model.components),
    editReason: model.editReason,
    editSource: BomEditSource.dailyBoms,
  };
}

/** No order number, tracking number or MI code — the API takes them from the rejected daily BOM. */
function toResampleBomDto(model: BomFormModel): ResampleBomDto {
  return {
    description: model.description,
    components: toComponentsDto(model.components),
  };
}
