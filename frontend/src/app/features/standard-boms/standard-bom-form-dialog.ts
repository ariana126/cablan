import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { applyEach, form, FormField, min, required, submit } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import { MatOption } from '@angular/material/core';
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
import { MatSelect } from '@angular/material/select';
import { firstValueFrom } from 'rxjs';

import { RegisterStandardBomDto, UpdateStandardBomDto } from '../../api/model';
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

export type StandardBomFormDialogData =
  | { readonly mode: 'create'; readonly products: readonly AppProduct[] }
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
 * re-pickable control.
 */
@Component({
  selector: 'app-standard-bom-form-dialog',
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
    MatOption,
    MatSelect,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>
      @if (data.mode === 'create') {
        ثبت آنالیز استاندارد جدید
      } @else {
        ویرایش آنالیز استاندارد {{ data.standardBom.miCode }}
      }
    </h2>

    <form novalidate (submit)="onSubmit(); $event.preventDefault()">
      @if (standardBomForm().touched() && standardBomForm().errors().length) {
        <p class="form-error" role="alert">{{ standardBomForm().errors()[0].message }}</p>
      }

      <mat-dialog-content class="stack">
        @if (data.mode === 'edit') {
          <p class="product-name"><strong>محصول:</strong> {{ productName }}</p>
        } @else {
          <mat-form-field appearance="outline">
            <mat-label>محصول</mat-label>
            <mat-select
              [formField]="standardBomForm.productId"
              (selectionChange)="onProductChange($event.value)"
            >
              @for (product of data.products; track product.id) {
                <mat-option [value]="product.id">{{ product.name }}</mat-option>
              }
            </mat-select>
            @if (
              standardBomForm.productId().touched() && standardBomForm.productId().errors().length
            ) {
              <mat-error>{{ standardBomForm.productId().errors()[0].message }}</mat-error>
            }
          </mat-form-field>
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
          <input matInput type="number" [formField]="standardBomForm.standardLength" />
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
                      <input matInput type="number" [formField]="material.weight" />
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

      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>انصراف</button>
        <button matButton="filled" type="submit" [disabled]="standardBomForm().submitting()">
          ثبت
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

  private readonly initial = this.data.mode === 'edit' ? this.data.standardBom : undefined;

  /** Fixed once registered — see the class doc — so this is a label, never a re-pickable field. */
  protected readonly productName =
    this.data.mode === 'edit'
      ? (this.data.products.find((product) => product.id === this.initial?.productId)?.name ?? '')
      : '';

  private readonly model = signal<StandardBomFormModel>({
    productId: this.initial?.productId ?? '',
    miCode: this.initial?.miCode ?? '',
    brand: this.initial?.brand ?? '',
    standardLength: this.initial?.standardLength ?? 0,
    active: this.initial === undefined ? '' : this.initial.active ? 'true' : 'false',
    description: this.initial?.description ?? '',
    components: this.initial ? componentsFromStandardBom(this.initial) : [],
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
    min(path.standardLength, 1, { message: 'متراژ استاندارد را به صورت عدد مثبت وارد کنید.' });

    applyEach(path.components, (component) => {
      applyEach(component.materials, (material) => {
        min(material.weight, 1, { message: 'وزن را به صورت عدد مثبت وارد کنید.' });
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
