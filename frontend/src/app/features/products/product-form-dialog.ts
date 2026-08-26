import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChildren,
} from '@angular/core';
import { applyEach, form, FormField, required, submit, validate } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
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
import { firstValueFrom } from 'rxjs';

import { UpdateProductDto } from '../../api/model';
import { AppProduct, ProductsGateway } from '../../core/products/products-gateway';
import { mapProductFormError, ProductFormModel, validateProductComposition } from './server-errors';

export type ProductFormDialogData =
  { readonly mode: 'create' } | { readonly mode: 'edit'; readonly product: AppProduct };

/**
 * Registering or editing a product's composition always creates brand-new components and
 * materials inline — there is no picker to reuse an existing master `Component`/`Material` row
 * (see `backend/src/modules/products/CLAUDE.md`), so every row here starts empty and carries only
 * a name. A newly added component row starts with *no* material rows, and a newly opened "create"
 * form starts with *no* component rows — either would otherwise mask the two composition
 * invariants this form enforces (`validateProductComposition`).
 */
@Component({
  selector: 'app-product-form-dialog',
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>
      @if (data.mode === 'create') {
        افزودن محصول
      } @else {
        ویرایش {{ data.product.name }}
      }
    </h2>

    <form novalidate (submit)="onSubmit(); $event.preventDefault()">
      <!-- Unlike the flat components/materials dialogs, this root error is reactive (see
           validateProductComposition's use in the schema below), not only a submit-time server
           response — gated on touched() so it doesn't greet an empty "create" form on open.
           Deliberately OUTSIDE mat-dialog-content: that element scrolls (see the .scss comment),
           and addComponent()/addMaterial() focus their new row's field, which the browser scrolls
           into view — if the banner lived inside that scrolling region, growing the list past the
           point of invalidity would scroll the very error explaining why straight out of view. -->
      @if (productForm().touched() && productForm().errors().length) {
        <p class="form-error" role="alert">{{ productForm().errors()[0].message }}</p>
      }

      <mat-dialog-content class="stack">
        <mat-form-field appearance="outline">
          <mat-label>اسم محصول</mat-label>
          <input matInput [formField]="productForm.name" autocomplete="off" />
          @if (productForm.name().touched() && productForm.name().errors().length) {
            <mat-error>{{ productForm.name().errors()[0].message }}</mat-error>
          }
        </mat-form-field>

        <div class="components stack--tight">
          @for (component of productForm.components; track $index; let componentIndex = $index) {
            <fieldset class="component-row" role="group" aria-label="جز">
              <legend>جز</legend>

              <mat-form-field appearance="outline">
                <mat-label>اسم جز</mat-label>
                <input
                  matInput
                  [formField]="component.name"
                  autocomplete="off"
                  #componentNameInput
                />
                @if (component.name().touched() && component.name().errors().length) {
                  <mat-error>{{ component.name().errors()[0].message }}</mat-error>
                }
              </mat-form-field>

              <div class="materials stack--tight">
                @for (material of component.materials; track $index; let materialIndex = $index) {
                  <fieldset class="material-row" role="group" aria-label="مواد اولیه">
                    <legend>مواد اولیه</legend>

                    <mat-form-field appearance="outline">
                      <mat-label>اسم مواد اولیه</mat-label>
                      <input
                        matInput
                        [formField]="material.name"
                        autocomplete="off"
                        #materialNameInput
                      />
                      @if (material.name().touched() && material.name().errors().length) {
                        <mat-error>{{ material.name().errors()[0].message }}</mat-error>
                      }
                    </mat-form-field>

                    <button
                      matButton
                      type="button"
                      (click)="removeMaterial(componentIndex, materialIndex)"
                    >
                      حذف مواد اولیه
                    </button>
                  </fieldset>
                }
              </div>

              <div class="component-row-actions">
                <button matButton type="button" (click)="addMaterial(componentIndex)">
                  افزودن مواد اولیه
                </button>
                <button matButton type="button" (click)="removeComponent(componentIndex)">
                  حذف جز
                </button>
              </div>
            </fieldset>
          }
        </div>

        <button matButton type="button" (click)="addComponent()">افزودن جز</button>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>انصراف</button>
        <button matButton="filled" type="submit" [disabled]="productForm().submitting()">
          ثبت
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styleUrl: './product-form-dialog.scss',
})
export class ProductFormDialog {
  private readonly dialogRef = inject(MatDialogRef<ProductFormDialog, boolean>);
  protected readonly data = inject<ProductFormDialogData>(MAT_DIALOG_DATA);
  private readonly productsGateway = inject(ProductsGateway);
  private readonly injector = inject(Injector);

  /**
   * `mat-dialog-content` scrolls (`product-form-dialog.scss` caps it at `max-height: 32rem`), so a
   * row appended while the dialog already has content — an edit form pre-filled with an existing
   * component, or a second/third add in the same session — can render entirely below the visible
   * scroll position with nothing to carry the user's eye (or a screen reader) to it. Focusing the
   * new row's own name field both scrolls it into view (a focused element's default browser
   * behaviour) and lets typing start immediately, so every `addComponent`/`addMaterial` ends by
   * focusing the field it just created once Angular has rendered it (`afterNextRender`, since these
   * run from a click handler, outside the constructor's own injection context).
   *
   * `read: ElementRef` is required here: a bare `#ref` queried via `viewChildren` resolves to the
   * first directive present on the element rather than the DOM node — `matInput` (`MatInput`) is
   * exactly such a directive — even though the same bare `#ref` used in template interpolation would
   * have given the native element. Without it, `focus()` is called on the wrong kind of object.
   */
  private readonly componentNameInputs = viewChildren<unknown, ElementRef<HTMLInputElement>>(
    'componentNameInput',
    { read: ElementRef },
  );
  private readonly materialNameInputs = viewChildren<unknown, ElementRef<HTMLInputElement>>(
    'materialNameInput',
    { read: ElementRef },
  );

  private readonly initial = this.data.mode === 'edit' ? this.data.product : undefined;

  private readonly model = signal<ProductFormModel>({
    name: this.initial?.name ?? '',
    components: (this.initial?.components ?? []).map((component) => ({
      id: component.id,
      name: component.name,
      materials: component.materials.map((material) => ({ id: material.id, name: material.name })),
    })),
  });

  protected readonly productForm = form(this.model, (path) => {
    required(path.name, { message: 'نام محصول را وارد کنید.' });
    validate(path, ({ value }) => validateProductComposition(value()));

    applyEach(path.components, (component) => {
      required(component.name, { message: 'نام جز را وارد کنید.' });

      applyEach(component.materials, (material) => {
        required(material.name, { message: 'نام مواد اولیه را وارد کنید.' });
      });
    });
  });

  protected addComponent(): void {
    this.model.update((m) => ({
      ...m,
      components: [...m.components, { name: '', materials: [] }],
    }));
    this.focusAfterRender(this.componentNameInputs, (inputs) => inputs.at(-1));
  }

  protected removeComponent(index: number): void {
    this.model.update((m) => ({
      ...m,
      components: m.components.filter((_, i) => i !== index),
    }));
  }

  protected addMaterial(componentIndex: number): void {
    this.model.update((m) => ({
      ...m,
      components: m.components.map((component, i) =>
        i === componentIndex
          ? { ...component, materials: [...component.materials, { name: '' }] }
          : component,
      ),
    }));
    const flatIndex = this.flatMaterialIndex(componentIndex);
    this.focusAfterRender(this.materialNameInputs, (inputs) => inputs[flatIndex]);
  }

  /**
   * `materialNameInputs` is one flat, template-order list spanning every component's materials —
   * component 0's rows, then component 1's, and so on — since the markup nests one `@for` inside
   * another rather than giving each component its own child component to scope a query to. Recomputes
   * the just-added material's position in that flat list from the model, now that `addMaterial` has
   * already appended it.
   */
  private flatMaterialIndex(componentIndex: number): number {
    const components = this.model().components;
    const precedingMaterials = components
      .slice(0, componentIndex)
      .reduce((total, component) => total + component.materials.length, 0);
    return precedingMaterials + components[componentIndex].materials.length - 1;
  }

  /**
   * Runs after Angular has rendered the row just added to the model — a plain post-update call, not
   * an injection-context one, so `afterNextRender` needs the injector captured in the field above.
   */
  private focusAfterRender(
    inputs: () => readonly ElementRef<HTMLInputElement>[],
    pick: (
      inputs: readonly ElementRef<HTMLInputElement>[],
    ) => ElementRef<HTMLInputElement> | undefined,
  ): void {
    afterNextRender(() => pick(inputs())?.nativeElement.focus(), { injector: this.injector });
  }

  protected removeMaterial(componentIndex: number, materialIndex: number): void {
    this.model.update((m) => ({
      ...m,
      components: m.components.map((component, i) =>
        i === componentIndex
          ? { ...component, materials: component.materials.filter((_, mi) => mi !== materialIndex) }
          : component,
      ),
    }));
  }

  protected onSubmit(): Promise<boolean> {
    return submit(this.productForm, async () => {
      try {
        if (this.data.mode === 'create') {
          await firstValueFrom(this.productsGateway.register(toRegisterProductDto(this.model())));
        } else {
          await firstValueFrom(
            this.productsGateway.update(this.data.product.id, toUpdateProductDto(this.model())),
          );
        }

        this.dialogRef.close(true);
        return undefined;
      } catch (error) {
        return mapProductFormError(error, this.productForm);
      }
    });
  }
}

/**
 * Rebuilds a plain DTO from the form's model rather than sending `model()` itself — signal forms
 * tags each array item with its own bookkeeping identity, which `HttpTestingController` (and a
 * strict server) would otherwise see as extra, unrequested properties on the wire.
 */
function toRegisterProductDto(model: ProductFormModel): ProductFormModel {
  return {
    name: model.name,
    components: model.components.map((component) => ({
      name: component.name,
      materials: component.materials.map((material) => ({ name: material.name })),
    })),
  };
}

/**
 * Builds the PATCH payload for an edit. Every component/material row from the form's current state
 * is sent, each carrying the `id` it was pre-filled with — from `this.data.product`, via the form
 * model — when it still corresponds to one of the product's existing rows, and none when the user
 * added it fresh in this session (`addComponent`/`addMaterial` start a new row with no `id`).
 *
 * This matters because registering *or editing* a product's composition would otherwise always
 * create brand-new `Component`/`Material` master rows for every entry it's given, colliding (409)
 * with the very row an existing, unchanged entry already is (see
 * `backend/src/modules/products/CLAUDE.md`). An `id` that matches the product's current composition
 * tells the backend to reuse that row as-is instead (see `EditProductComponentDto`/
 * `EditProductMaterialDto`), which is what makes resending an unchanged row — or changing a
 * *sibling* row, as when a new material is added next to ones that didn't change — safe.
 *
 * The `id` travels with each row in the form model itself (set once, when the model is built from
 * `this.initial`) rather than being reconciled against `this.data.product`'s arrays by index here —
 * `removeComponent`/`removeMaterial` splice by index, so a later row sliding into an earlier one's
 * position would otherwise inherit that position's id instead of its own.
 */
function toUpdateProductDto(model: ProductFormModel): UpdateProductDto {
  return {
    name: model.name,
    components: model.components.map((component) => ({
      ...(component.id !== undefined ? { id: component.id } : {}),
      name: component.name,
      materials: component.materials.map((material) => ({
        ...(material.id !== undefined ? { id: material.id } : {}),
        name: material.name,
      })),
    })),
  };
}
