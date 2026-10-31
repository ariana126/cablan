import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { applyEach, disabled, form, FormField, required, submit } from '@angular/forms/signals';
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
import { firstValueFrom } from 'rxjs';

import { BomEditSource, RegisterBomDto, ResampleBomDto, UpdateBomDto } from '../../api/model';
import { AppBom, BomsGateway } from '../../core/boms/boms-gateway';
import { positiveNumber } from '../../core/forms/positive-number';
import { AppProduct } from '../../core/products/products-gateway';
import { AppStandardBom } from '../../core/standard-boms/standard-boms-gateway';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import {
  SearchableSelect,
  SearchableSelectOption,
} from '../../ui/searchable-select/searchable-select';
import { BomComponentLineFormModel, BomFormModel, mapBomFormError } from './server-errors';
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
 * **Edit mode asks why («دلیل ویرایش», issue #73)** — the row's «ویرایش» and the post-registration
 * preview's alike — and sends it with `editSource: 'dailyBoms'`. It is never required client-side:
 * a save that changes nothing goes through without one, and an edit that does change something
 * without one is refused by the API (`edit-reason-required`), shown on that field.
 *
 * **Resample mode («نمونه گیری مجدد»)** registers a new daily BOM from a rejected one: its order
 * number, tracking number and MI code are shown filled in and disabled (the API takes them from the
 * source, so the request does not even carry them), the composition is that standard BOM's current
 * one with every weight empty — a fresh sample is a fresh measurement — and the description starts
 * empty. The MI code is a plain disabled input there rather than the picker, which has no disabled
 * state of its own. Validation and error display are registration's.
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
    SearchableSelect,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-head [heading]="heading" subtitle="فیلدهای ستاره‌دار الزامی است." />

    <form novalidate (submit)="onSubmit(); $event.preventDefault()">
      <mat-dialog-content class="stack">
        <!-- A failure that belongs to no single field, at the top of the content. -->
        @if (bomForm().touched() && bomForm().errors().length) {
          <app-error-banner [message]="bomForm().errors()[0].message ?? ''" />
        }

        @if (data.mode === 'resample') {
          <mat-form-field appearance="outline">
            <mat-label>کد MI آنالیز استاندارد</mat-label>
            <input matInput [formField]="bomForm.standardBomMiCode" />
          </mat-form-field>
        } @else {
          <app-searchable-select
            label="کد MI آنالیز استاندارد"
            [field]="bomForm.standardBomMiCode"
            [options]="standardBomOptions"
            (selected)="onStandardBomChange($event)"
          />
        }

        @if (productName(); as name) {
          <mat-form-field appearance="outline">
            <mat-label>نام محصول</mat-label>
            <input matInput readonly [value]="name" />
          </mat-form-field>
        }

        <!-- Two short, related fields share a row. -->
        <div class="field-row">
          <mat-form-field appearance="outline">
            <mat-label>شماره سفارش</mat-label>
            <input matInput [formField]="bomForm.orderNumber" autocomplete="off" />
            @if (bomForm.orderNumber().touched() && bomForm.orderNumber().errors().length) {
              <mat-error>{{ bomForm.orderNumber().errors()[0].message }}</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>شماره ردیابی</mat-label>
            <input matInput [formField]="bomForm.trackingNumber" autocomplete="off" />
            @if (bomForm.trackingNumber().touched() && bomForm.trackingNumber().errors().length) {
              <mat-error>{{ bomForm.trackingNumber().errors()[0].message }}</mat-error>
            }
          </mat-form-field>
        </div>

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
            <p>ابتدا یک آنالیز استاندارد را انتخاب کنید تا اجزای آن نمایش داده شود.</p>
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

  /** Searchable by MI code or brand — the label carries both. */
  protected readonly standardBomOptions: readonly SearchableSelectOption[] =
    this.data.standardBoms.map((standardBom) => ({
      value: standardBom.miCode,
      label: `${standardBom.miCode} — ${standardBom.brand}`,
    }));

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
    disabled(path.standardBomMiCode, inherited);
    disabled(path.orderNumber, inherited);
    disabled(path.trackingNumber, inherited);

    required(path.standardBomMiCode, { message: 'کد MI آنالیز استاندارد را انتخاب کنید.' });
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
   * materials — every weight starts unset, since a different standard BOM means an unrelated
   * composition, and a daily BOM's weight is always a fresh measurement, never cloned from the
   * standard BOM's own recorded one. */
  protected onStandardBomChange(miCode: string): void {
    const standardBom = this.data.standardBoms.find((candidate) => candidate.miCode === miCode);
    this.model.update((m) => ({
      ...m,
      standardBomMiCode: miCode,
      components: standardBom ? componentsFromStandardBom(standardBom) : [],
    }));
  }

  protected onSubmit(): Promise<boolean> {
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
