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

import { RegisterBomDto, UpdateBomDto } from '../../api/model';
import { AppBom, BomsGateway } from '../../core/boms/boms-gateway';
import { AppStandardBom } from '../../core/standard-boms/standard-boms-gateway';
import { BomComponentLineFormModel, BomFormModel, mapBomFormError } from './server-errors';

export type BomFormDialogData =
  | { readonly mode: 'create'; readonly standardBoms: readonly AppStandardBom[] }
  | {
      readonly mode: 'edit';
      readonly bom: AppBom;
      readonly standardBoms: readonly AppStandardBom[];
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
 */
@Component({
  selector: 'app-bom-form-dialog',
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
        ثبت آنالیز روزانه جدید
      } @else {
        ویرایش آنالیز روزانه {{ data.bom.orderNumber }}
      }
    </h2>

    <form novalidate (submit)="onSubmit(); $event.preventDefault()">
      @if (bomForm().touched() && bomForm().errors().length) {
        <p class="form-error" role="alert">{{ bomForm().errors()[0].message }}</p>
      }

      <mat-dialog-content class="stack">
        <mat-form-field appearance="outline">
          <mat-label>کد MI آنالیز استاندارد</mat-label>
          <mat-select
            [formField]="bomForm.standardBomMiCode"
            (selectionChange)="onStandardBomChange($event.value)"
          >
            @for (standardBom of data.standardBoms; track standardBom.id) {
              <mat-option [value]="standardBom.miCode">
                {{ standardBom.miCode }} — {{ standardBom.brand }}
              </mat-option>
            }
          </mat-select>
          @if (
            bomForm.standardBomMiCode().touched() && bomForm.standardBomMiCode().errors().length
          ) {
            <mat-error>{{ bomForm.standardBomMiCode().errors()[0].message }}</mat-error>
          }
        </mat-form-field>

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

        <mat-form-field appearance="outline">
          <mat-label>توضیحات</mat-label>
          <textarea matInput [formField]="bomForm.description"></textarea>
        </mat-form-field>

        @if (bomForm.components.length === 0) {
          <p>ابتدا یک آنالیز استاندارد را انتخاب کنید تا اجزای آن نمایش داده شود.</p>
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
        <button matButton="filled" type="submit" [disabled]="bomForm().submitting()">ثبت</button>
      </mat-dialog-actions>
    </form>
  `,
  styleUrl: './bom-form-dialog.scss',
})
export class BomFormDialog {
  private readonly dialogRef = inject(MatDialogRef<BomFormDialog, boolean>);
  protected readonly data = inject<BomFormDialogData>(MAT_DIALOG_DATA);
  private readonly bomsGateway = inject(BomsGateway);

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

  private readonly model = signal<BomFormModel>({
    standardBomMiCode: this.initialStandardBomMiCode,
    orderNumber: this.initial?.orderNumber ?? '',
    trackingNumber: this.initial?.trackingNumber ?? '',
    description: this.initial?.description ?? '',
    components: this.initial ? componentsFromBom(this.initial) : [],
  });

  protected readonly bomForm = form(this.model, (path) => {
    required(path.standardBomMiCode, { message: 'کد MI آنالیز استاندارد را انتخاب کنید.' });
    required(path.orderNumber, { message: 'شماره سفارش را وارد کنید.' });
    required(path.trackingNumber, { message: 'شماره ردیابی را وارد کنید.' });

    applyEach(path.components, (component) => {
      applyEach(component.materials, (material) => {
        min(material.weight, 1, { message: 'وزن مواد اولیه را به صورت عدد مثبت وارد کنید.' });
      });
    });
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
        if (this.data.mode === 'create') {
          await firstValueFrom(this.bomsGateway.register(toRegisterBomDto(this.model())));
        } else {
          await firstValueFrom(
            this.bomsGateway.update(this.data.bom.id, toUpdateBomDto(this.model())),
          );
        }

        this.dialogRef.close(true);
        return undefined;
      } catch (error) {
        return mapBomFormError(error, this.bomForm);
      }
    });
  }
}

function componentsFromStandardBom(standardBom: AppStandardBom): BomComponentLineFormModel[] {
  return standardBom.components.map((component) => ({
    componentId: component.id,
    name: component.name,
    materials: component.materials.map((material) => ({
      materialId: material.id,
      name: material.name,
      weight: 0,
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

function toUpdateBomDto(model: BomFormModel): UpdateBomDto {
  return {
    standardBomMiCode: model.standardBomMiCode,
    orderNumber: model.orderNumber,
    trackingNumber: model.trackingNumber,
    description: model.description,
    components: toComponentsDto(model.components),
  };
}
