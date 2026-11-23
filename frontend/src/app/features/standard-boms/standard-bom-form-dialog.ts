import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { applyEach, form, FormField, required, submit } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import { MatOption } from '@angular/material/core';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSelect } from '@angular/material/select';
import { MatIcon } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';

import { RegisterStandardBomDto, UpdateStandardBomDto } from '../../api/model';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { RevealFormErrors } from '../../ui/reveal-form-errors/reveal-form-errors';
import {
  SearchableSelect,
  SearchableSelectOption,
} from '../../ui/searchable-select/searchable-select';
import { positiveNumber } from '../../core/forms/positive-number';
import { AppProduct } from '../../core/products/products-gateway';
import {
  AppStandardBom,
  StandardBomsGateway,
} from '../../core/standard-boms/standard-boms-gateway';
import {
  mapStandardBomFormError,
  StandardBomComponentLineFormModel,
  StandardBomFormModel,
} from './server-errors';
import { Icon } from '../../ui/icon/icon';

export type StandardBomFormDialogData =
  | {
      readonly mode: 'create';
      readonly products: readonly AppProduct[];
      /** The product to register the standard BOM for, fixed — the products page's offer right
       * after registering it (issue #128). Unset, the visitor picks one. */
      readonly lockedProductId?: string;
      /** «تعریف آنالیز مشابه» (issue #133): the standard BOM the new one starts as a copy of — every
       * field and standard weight pre-filled, the product still re-pickable. Unset, the form opens
       * empty. */
      readonly source?: AppStandardBom;
    }
  | {
      readonly mode: 'edit';
      readonly standardBom: AppStandardBom;
      readonly products: readonly AppProduct[];
    };

/**
 * A Standard BOM's composition is never freely typed: every component/material line is cloned from
 * a product's own current composition — chosen in create mode, already recorded in edit mode — and
 * the backend does the actual cloning server-side (see `backend/src/modules/standard-boms/CLAUDE.md`).
 * This form's only job on a composition line is collecting its `weight`; `componentId`/`materialId`/
 * `name` travel along for display and for the payload, never through an editable field. The product
 * itself cannot be changed once registered, so in edit mode it renders as a plain label, not a
 * re-pickable control — as it does in create mode when the opener locks it (`lockedProductId`: the
 * products page's offer right after a registration, issue #128), its composition then cloned up
 * front.
 */
@Component({
  selector: 'app-standard-bom-form-dialog',
  imports: [
    DialogHead,
    ErrorBanner,
    RevealFormErrors,
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
    SearchableSelect,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-head
      [heading]="
        data.mode === 'create'
          ? 'ثبت آنالیز استاندارد جدید'
          : 'ویرایش آنالیز استاندارد ' + data.standardBom.miCode
      "
      subtitle="فیلدهای ستاره‌دار الزامی است."
    />

    <form
      [appRevealFormErrors]="standardBomForm"
      novalidate
      (submit)="onSubmit(); $event.preventDefault()"
    >
      <mat-dialog-content class="stack">
        <!-- A failure that belongs to no single field, at the top of the content. -->
        @if (standardBomForm().touched() && standardBomForm().errors().length) {
          <app-error-banner [message]="standardBomForm().errors()[0].message ?? ''" />
        }

        @if (productFixed) {
          <p class="product-name"><strong>محصول:</strong> {{ productName }}</p>
        } @else {
          <app-searchable-select
            label="محصول"
            [field]="standardBomForm.productId"
            [options]="productOptions"
            (selected)="onProductChange($event)"
          />
        }

        <mat-form-field appearance="outline">
          <mat-label>کد MI</mat-label>
          <input matInput [formField]="standardBomForm.miCode" autocomplete="off" />
          @if (standardBomForm.miCode().touched() && standardBomForm.miCode().errors().length) {
            <mat-error>{{ standardBomForm.miCode().errors()[0].message }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>برند</mat-label>
          <input matInput [formField]="standardBomForm.brand" autocomplete="off" />
          @if (standardBomForm.brand().touched() && standardBomForm.brand().errors().length) {
            <mat-error>{{ standardBomForm.brand().errors()[0].message }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>متراژ استاندارد</mat-label>
          <input matInput type="number" step="any" [formField]="standardBomForm.standardLength" />
          @if (
            standardBomForm.standardLength().touched() &&
            standardBomForm.standardLength().errors().length
          ) {
            <mat-error>{{ standardBomForm.standardLength().errors()[0].message }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>فعال بودن</mat-label>
          <mat-select
            [formField]="standardBomForm.active"
            (selectionChange)="onActiveChange($event.value)"
          >
            <mat-option value="true">فعال</mat-option>
            <mat-option value="false">غیرفعال</mat-option>
          </mat-select>
          @if (standardBomForm.active().touched() && standardBomForm.active().errors().length) {
            <mat-error>{{ standardBomForm.active().errors()[0].message }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>توضیحات</mat-label>
          <textarea matInput [formField]="standardBomForm.description"></textarea>
        </mat-form-field>

        @if (standardBomForm.components.length === 0) {
          <p>ابتدا محصولی را انتخاب کنید تا اجزای آن نمایش داده شود.</p>
        } @else {
          <div class="components stack--tight">
            @for (component of standardBomForm.components; track $index) {
              <fieldset
                class="component-row"
                role="group"
                [attr.aria-label]="'جز ' + component().value().name"
              >
                <legend>{{ component().value().name }}</legend>

                <div class="materials stack--tight">
                  @for (material of component.materials; track $index) {
                    <mat-form-field appearance="outline">
                      <mat-label>وزن استاندارد «{{ material().value().name }}» (گرم)</mat-label>
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
        <button matButton="filled" type="submit" [disabled]="standardBomForm().submitting()">
          <mat-icon appIcon="check" />
          ثبت آنالیز
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styleUrl: './standard-bom-form-dialog.scss',
})
export class StandardBomFormDialog {
  private readonly dialogRef = inject(MatDialogRef<StandardBomFormDialog, boolean>);
  protected readonly data = inject<StandardBomFormDialogData>(MAT_DIALOG_DATA);
  private readonly standardBomsGateway = inject(StandardBomsGateway);

  protected readonly productOptions: readonly SearchableSelectOption[] = this.data.products.map(
    (product) => ({ value: product.id, label: product.name }),
  );

  private readonly initial = this.data.mode === 'edit' ? this.data.standardBom : undefined;

  /** What the fields open with: the standard BOM being edited, or the one a new one copies. */
  private readonly prefill =
    this.initial ?? (this.data.mode === 'create' ? this.data.source : undefined);

  /** The product a create form was opened for, fixed (issue #128) — `undefined` when the visitor
   * picks one. */
  private readonly lockedProduct = lockedProductOf(this.data);

  private readonly fixedProductId = this.initial?.productId ?? this.lockedProduct?.id ?? '';

  /** Fixed once registered — see the class doc — or locked by whoever opened the form, so this is
   * a label, never a re-pickable field. */
  protected readonly productFixed = this.fixedProductId !== '';

  protected readonly productName =
    this.data.products.find((product) => product.id === this.fixedProductId)?.name ?? '';

  private readonly model = signal<StandardBomFormModel>({
    productId: this.fixedProductId || (this.prefill?.productId ?? ''),
    miCode: this.prefill?.miCode ?? '',
    brand: this.prefill?.brand ?? '',
    standardLength: this.prefill?.standardLength ?? 0,
    active: this.prefill === undefined ? '' : this.prefill.active ? 'true' : 'false',
    description: this.prefill?.description ?? '',
    components: this.prefill
      ? componentsFromStandardBom(this.prefill)
      : this.lockedProduct
        ? componentsFromProduct(this.lockedProduct)
        : [],
  });

  protected readonly standardBomForm = form(this.model, (path) => {
    // "Must be explicit" is a registration-only rule (see `registring-standard-bom.feature`'s
    // "وضعیت فعال بودن آنالیز استاندارد باید هنگام ثبت توسط کاربر مشخص شود") — an edit always
    // starts pre-filled from the standard BOM's own current value, so there is nothing to force.
    if (this.data.mode === 'create') {
      required(path.productId, { message: 'محصول را انتخاب کنید.' });
      required(path.active, { message: 'وضعیت فعال بودن را مشخص کنید.' });
    }

    required(path.miCode, { message: 'کد MI را وارد کنید.' });
    required(path.brand, { message: 'برند را وارد کنید.' });
    positiveNumber(path.standardLength, {
      message: 'متراژ استاندارد را به صورت عدد مثبت وارد کنید.',
    });

    applyEach(path.components, (component) => {
      applyEach(component.materials, (material) => {
        positiveNumber(material.weight, { message: 'وزن را به صورت عدد مثبت وارد کنید.' });
      });
    });
  });

  /** Rebuilds the composition from the newly chosen product's *current* components and materials —
   * every weight starts unset, since a different product means an unrelated composition. */
  protected onProductChange(productId: string): void {
    const product = this.data.products.find((candidate) => candidate.id === productId);
    this.model.update((m) => ({
      ...m,
      productId,
      components: product ? componentsFromProduct(product) : [],
    }));
  }

  protected onActiveChange(value: '' | 'true' | 'false'): void {
    this.model.update((m) => ({ ...m, active: value }));
  }

  protected onSubmit(): Promise<boolean> {
    return submit(this.standardBomForm, async () => {
      try {
        if (this.data.mode === 'create') {
          await firstValueFrom(
            this.standardBomsGateway.register(toRegisterStandardBomDto(this.model())),
          );
        } else {
          await firstValueFrom(
            this.standardBomsGateway.update(
              this.data.standardBom.id,
              toUpdateStandardBomDto(this.model()),
            ),
          );
        }

        this.dialogRef.close(true);
        return undefined;
      } catch (error) {
        return mapStandardBomFormError(error, this.standardBomForm);
      }
    });
  }
}

function lockedProductOf(data: StandardBomFormDialogData): AppProduct | undefined {
  if (data.mode !== 'create' || data.lockedProductId === undefined) {
    return undefined;
  }
  const { lockedProductId } = data;
  return data.products.find((product) => product.id === lockedProductId);
}

function componentsFromProduct(product: AppProduct): StandardBomComponentLineFormModel[] {
  return product.components.map((component) => ({
    componentId: component.id,
    name: component.name,
    materials: component.materials.map((material) => ({
      materialId: material.id,
      name: material.name,
      weight: 0,
    })),
  }));
}

/** Edit mode never re-clones from the live product — see the class doc — so this reads the standard
 * BOM's own already-cloned composition, weights included, rather than `AppProduct`. */
function componentsFromStandardBom(
  standardBom: AppStandardBom,
): StandardBomComponentLineFormModel[] {
  return standardBom.components.map((component) => ({
    componentId: component.id,
    name: component.name,
    materials: component.materials.map((material) => ({
      materialId: material.id,
      name: material.name,
      weight: material.weight,
    })),
  }));
}

function toComponentsDto(components: readonly StandardBomComponentLineFormModel[]) {
  return components.map((component) => ({
    componentId: component.componentId,
    materials: component.materials.map((material) => ({
      materialId: material.materialId,
      weight: material.weight,
    })),
  }));
}

function toRegisterStandardBomDto(model: StandardBomFormModel): RegisterStandardBomDto {
  return {
    productId: model.productId,
    miCode: model.miCode,
    brand: model.brand,
    standardLength: model.standardLength,
    active: model.active === 'true',
    ...(model.description !== '' ? { description: model.description } : {}),
    components: toComponentsDto(model.components),
  };
}

function toUpdateStandardBomDto(model: StandardBomFormModel): UpdateStandardBomDto {
  return {
    miCode: model.miCode,
    brand: model.brand,
    standardLength: model.standardLength,
    active: model.active === 'true',
    ...(model.description !== '' ? { description: model.description } : {}),
    components: toComponentsDto(model.components),
  };
}
