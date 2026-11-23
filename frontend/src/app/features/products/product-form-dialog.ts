import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChildren,
} from '@angular/core';
import { applyEach, form, FormField, required, submit, validate } from '@angular/forms/signals';
import { MatButton, MatIconButton } from '@angular/material/button';
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
import { MatTooltip } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import {
  CorrectionConfirmation,
  withCorrection,
} from '../../ui/correction-confirmation/correction-confirmation';

import { UpdateProductDto } from '../../api/model';
import { AppComponent as AppComponentRecord } from '../../core/components/components-gateway';
import { AppMaterial } from '../../core/materials/materials-gateway';
import { AppProduct, ProductsGateway } from '../../core/products/products-gateway';
import { DialogHead } from '../../ui/dialog-head/dialog-head';
import { ErrorBanner } from '../../ui/error-banner/error-banner';
import { RevealFormErrors } from '../../ui/reveal-form-errors/reveal-form-errors';
import {
  SearchableSelect,
  SearchableSelectOption,
} from '../../ui/searchable-select/searchable-select';
import { mapProductFormError, ProductFormModel, validateProductComposition } from './server-errors';
import { Icon } from '../../ui/icon/icon';
import { toPersianDigits } from '../../core/i18n/persian-numerals';

type MoveDirection = 'up' | 'down';

export type ProductFormDialogData = (
  { readonly mode: 'create' } | { readonly mode: 'edit'; readonly product: AppProduct }
) & {
  /** The already-registered `Component`/`Material` master rows this dialog's pickers are built
   * from — fetched by whichever page opens it (`ProductsPage`), not by the dialog itself. */
  readonly components: readonly AppComponentRecord[];
  readonly materials: readonly AppMaterial[];
};

/** What the dialog closes with: the registered product in create mode (issue #128 offers its
 * standard BOM next), `true` after an edit, nothing when cancelled. */
export type ProductFormDialogResult = AppProduct | true | undefined;

/**
 * Registering or editing a product's composition never creates a new master `Component`/`Material`
 * row — the backend rejects a component/material name that doesn't already resolve to one, with a
 * 400 `component-not-registered`/`material-not-registered` problem (see
 * `backend/src/modules/products/CLAUDE.md`'s "The one place this module crosses another module's
 * boundary"). So every component/material row here is a searchable picker (`app-searchable-select`) populated from the
 * already-registered `components`/`materials` lists (`data.components`/`data.materials`) rather
 * than a free-text field — a name can only ever be one already known to the backend, though the
 * server-side check still applies at submit time, since that list is a snapshot taken when this
 * dialog opened (`mapProductFormError`'s `componentNotRegistered`/`materialNotRegistered` cases
 * handle a name that stopped being registered in the meantime). A newly added component row starts
 * with *no* material rows, and a newly opened "create" form starts with *no* component rows —
 * either would otherwise mask the two composition invariants this form enforces
 * (`validateProductComposition`).
 */
@Component({
  selector: 'app-product-form-dialog',
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
    MatIconButton,
    MatInput,
    MatLabel,
    MatTooltip,
    SearchableSelect,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-head
      [heading]="data.mode === 'create' ? 'افزودن محصول' : 'ویرایش ' + data.product.name"
      subtitle="فیلدهای ستاره‌دار الزامی است."
    />

    <form
      [appRevealFormErrors]="productForm"
      novalidate
      (submit)="onSubmit(); $event.preventDefault()"
    >
      <!-- Unlike the flat components/materials dialogs, this root error is reactive (see
           validateProductComposition's use in the schema below), not only a submit-time server
           response — gated on touched() so it doesn't greet an empty "create" form on open.
           Deliberately OUTSIDE mat-dialog-content: that element scrolls (see the .scss comment),
           and addComponent()/addMaterial() focus their new row's field, which the browser scrolls
           into view — if the banner lived inside that scrolling region, growing the list past the
           point of invalidity would scroll the very error explaining why straight out of view. -->
      @if (productForm().touched() && productForm().errors().length) {
        <div class="form-error-slot">
          <app-error-banner [message]="productForm().errors()[0].message ?? ''" />
        </div>
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

              <div class="component-row-head">
                <app-searchable-select
                  label="اسم جز"
                  [field]="component.name"
                  [options]="componentOptions"
                  (selected)="onComponentNameChange(componentIndex, $event)"
                  #componentNameSelect
                />

                <!-- The order on screen is the order sent (issue #122); the row's materials move
                     with it. Each button is named by its component, so a row is told apart. -->
                <div class="component-row-order">
                  <button
                    matIconButton
                    class="icon-button--small"
                    type="button"
                    [attr.aria-label]="moveLabel(componentIndex, 'up')"
                    [matTooltip]="moveLabel(componentIndex, 'up')"
                    [disabled]="componentIndex === 0"
                    (click)="moveComponent(componentIndex, 'up')"
                    #moveUpButton
                  >
                    <mat-icon appIcon="move-up" />
                  </button>
                  <button
                    matIconButton
                    class="icon-button--small"
                    type="button"
                    [attr.aria-label]="moveLabel(componentIndex, 'down')"
                    [matTooltip]="moveLabel(componentIndex, 'down')"
                    [disabled]="componentIndex === lastComponentIndex()"
                    (click)="moveComponent(componentIndex, 'down')"
                    #moveDownButton
                  >
                    <mat-icon appIcon="move-down" />
                  </button>
                </div>
              </div>

              <div class="materials stack--tight">
                @for (material of component.materials; track $index; let materialIndex = $index) {
                  <fieldset class="material-row" role="group" aria-label="مواد اولیه">
                    <legend>مواد اولیه</legend>

                    <app-searchable-select
                      label="اسم مواد اولیه"
                      [field]="material.name"
                      [options]="materialOptions"
                      (selected)="onMaterialNameChange(componentIndex, materialIndex, $event)"
                      #materialNameSelect
                    />

                    <button
                      matButton
                      type="button"
                      (click)="removeMaterial(componentIndex, materialIndex)"
                    >
                      <mat-icon appIcon="delete" />
                      حذف مواد اولیه
                    </button>
                  </fieldset>
                }
              </div>

              <div class="component-row-actions">
                @if (data.materials.length === 0) {
                  <p>
                    هیچ مواد اولیه‌ای ثبت نشده است. برای افزودن مواد اولیه به این جز، ابتدا یک مورد
                    را از صفحهٔ «مدیریت مواد اولیه» ثبت کنید.
                  </p>
                } @else {
                  <button matButton type="button" (click)="addMaterial(componentIndex)">
                    <mat-icon appIcon="add" />
                    افزودن مواد اولیه
                  </button>
                }
                <button matButton type="button" (click)="removeComponent(componentIndex)">
                  <mat-icon appIcon="delete" />
                  حذف جز
                </button>
              </div>
            </fieldset>
          }
        </div>

        @if (data.components.length === 0) {
          <p>
            هیچ جزی ثبت نشده است. برای افزودن جز به این محصول، ابتدا یک جز را از صفحهٔ «مدیریت اجزا»
            ثبت کنید.
          </p>
        } @else {
          <button matButton type="button" (click)="addComponent()">
            <mat-icon appIcon="add" />افزودن جز
          </button>
        }
      </mat-dialog-content>

      <mat-dialog-actions class="dialog-footer">
        <button matButton type="button" mat-dialog-close>
          <mat-icon appIcon="cancel" />انصراف
        </button>
        <button matButton="filled" type="submit" [disabled]="productForm().submitting()">
          <mat-icon appIcon="check" />
          ثبت محصول
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styleUrl: './product-form-dialog.scss',
})
export class ProductFormDialog {
  private readonly dialogRef = inject(MatDialogRef<ProductFormDialog, ProductFormDialogResult>);
  protected readonly data = inject<ProductFormDialogData>(MAT_DIALOG_DATA);
  private readonly productsGateway = inject(ProductsGateway);
  private readonly injector = inject(Injector);
  private readonly correction = inject(CorrectionConfirmation);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * `mat-dialog-content` scrolls (`product-form-dialog.scss` caps it at `max-height: 32rem`), so a
   * row appended while the dialog already has content — an edit form pre-filled with an existing
   * component, or a second/third add in the same session — can render entirely below the visible
   * scroll position with nothing to carry the user's eye (or a screen reader) to it. Focusing the
   * new row's own picker both scrolls it into view (a focused element's default browser behaviour)
   * and opens it for interaction immediately, so every `addComponent`/`addMaterial` ends by
   * focusing the select it just created once Angular has rendered it (`afterNextRender`, since these
   * run from a click handler, outside the constructor's own injection context).
   *
   * A bare `#ref` on `app-searchable-select` resolves to the component instance, whose `focus()` is
   * its own public API for moving focus into its text box.
   */
  private readonly componentNameSelects = viewChildren<SearchableSelect>('componentNameSelect');
  private readonly materialNameSelects = viewChildren<SearchableSelect>('materialNameSelect');
  /** The rows' move buttons, in row order — where `moveComponent` puts focus back. */
  private readonly moveUpButtons = viewChildren<string, ElementRef<HTMLButtonElement>>(
    'moveUpButton',
    { read: ElementRef },
  );
  private readonly moveDownButtons = viewChildren<string, ElementRef<HTMLButtonElement>>(
    'moveDownButton',
    { read: ElementRef },
  );

  /** Pickers are searched by name, and the name is also what the backend resolves a row by. A
   * material is also findable by its code, though its option shows the name alone. */
  protected readonly componentOptions: readonly SearchableSelectOption[] = this.data.components.map(
    (component) => ({ value: component.name, label: component.name }),
  );
  protected readonly materialOptions: readonly SearchableSelectOption[] = this.data.materials.map(
    (material) => ({ value: material.name, label: material.name, searchTerms: [material.code] }),
  );

  private readonly initial = this.data.mode === 'edit' ? this.data.product : undefined;

  /** The form as it opened — what an edit is compared with to tell a rename from a recomposition. */
  private readonly initialModel: ProductFormModel = {
    name: this.initial?.name ?? '',
    components: (this.initial?.components ?? []).map((component) => ({
      id: component.id,
      name: component.name,
      materials: component.materials.map((material) => ({ id: material.id, name: material.name })),
    })),
  };

  private readonly model = signal<ProductFormModel>(this.initialModel);

  protected readonly productForm = form(this.model, (path) => {
    required(path.name, { message: 'نام محصول را وارد کنید.' });
    validate(path, ({ value }) => validateProductComposition(value()));

    applyEach(path.components, (component) => {
      required(component.name, { message: 'یک جز را انتخاب کنید.' });

      applyEach(component.materials, (material) => {
        required(material.name, { message: 'یک مواد اولیه را انتخاب کنید.' });
      });
    });
  });

  protected addComponent(): void {
    this.model.update((m) => ({
      ...m,
      components: [...m.components, { name: '', materials: [] }],
    }));
    this.focusAfterRender(this.componentNameSelects, (selects) => selects.at(-1));
  }

  protected readonly lastComponentIndex = computed(() => this.model().components.length - 1);

  /** «انتقال هادی به بالا» — a row with no component chosen yet is named by its position. */
  protected moveLabel(index: number, direction: MoveDirection): string {
    const name = this.model().components[index]?.name || `جز ${toPersianDigits(String(index + 1))}`;
    return `انتقال ${name} ${direction === 'up' ? 'به بالا' : 'به پایین'}`;
  }

  /**
   * Swaps a component row with its neighbour, its materials (and ids) travelling with it — the
   * order on screen is the order the API stores (issue #122). Rows are tracked by position, so
   * focus would otherwise stay on the button that now belongs to the neighbour: it follows the
   * moved component instead, onto its other button once it has reached an end.
   */
  protected moveComponent(index: number, direction: MoveDirection): void {
    const target = direction === 'up' ? index - 1 : index + 1;
    const components = [...this.model().components];
    if (target < 0 || target >= components.length) {
      return;
    }
    [components[index], components[target]] = [components[target], components[index]];
    this.model.update((m) => ({ ...m, components }));

    const reachedEnd = direction === 'up' ? target === 0 : target === components.length - 1;
    const focusUp = (direction === 'up') !== reachedEnd;
    const buttons = focusUp ? this.moveUpButtons : this.moveDownButtons;
    afterNextRender(() => buttons()[target]?.nativeElement.focus(), { injector: this.injector });
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
    this.focusAfterRender(this.materialNameSelects, (selects) => selects[flatIndex]);
  }

  /** Writes the picked component name onto that row — the picker's `(selected)` output, which
   * fires after it has already written the field itself. This is also the seam a spec drives
   * directly (see `product-form-dialog.spec.ts`). */
  protected onComponentNameChange(componentIndex: number, name: string): void {
    this.model.update((m) => ({
      ...m,
      components: m.components.map((component, i) =>
        i === componentIndex ? { ...component, name } : component,
      ),
    }));
  }

  /** Same idea as `onComponentNameChange`, one level down. */
  protected onMaterialNameChange(
    componentIndex: number,
    materialIndex: number,
    name: string,
  ): void {
    this.model.update((m) => ({
      ...m,
      components: m.components.map((component, i) =>
        i === componentIndex
          ? {
              ...component,
              materials: component.materials.map((material, mi) =>
                mi === materialIndex ? { ...material, name } : material,
              ),
            }
          : component,
      ),
    }));
  }

  /**
   * `materialNameSelects` is one flat, template-order list spanning every component's materials —
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
    selects: () => readonly SearchableSelect[],
    pick: (selects: readonly SearchableSelect[]) => SearchableSelect | undefined,
  ): void {
    afterNextRender(() => pick(selects())?.focus(), { injector: this.injector });
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
          const registered = await firstValueFrom(
            this.productsGateway.register(toRegisterProductDto(this.model())),
          );
          this.dialogRef.close(registered);
          return undefined;
        } else {
          // Only the name is correctable (issue #110): a changed composition stays refused. A
          // reorder alone is no change to refuse (issue #122) and rides along with a correction.
          const { id } = this.data.product;
          const changes = toUpdateProductDto(this.model());
          const outcome = await this.correction.save(
            (applyToRelatedRecords) =>
              this.productsGateway.update(id, withCorrection(changes, applyToRelatedRecords)),
            sameComposition(changes, toUpdateProductDto(this.initialModel)),
            this.host.nativeElement.querySelector('input'),
          );
          if (outcome === 'declined') {
            return undefined;
          }
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

/** Whether two edits name the same components with the same materials, in any component order —
 * i.e. only the product's name (and the order, which rides along with a correction, issue #122)
 * may differ. */
function sameComposition(edited: UpdateProductDto, original: UpdateProductDto): boolean {
  const lines = (dto: UpdateProductDto) =>
    (dto.components ?? []).map((component) => JSON.stringify(component)).sort();
  return JSON.stringify(lines(edited)) === JSON.stringify(lines(original));
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
