import { HttpErrorResponse } from '@angular/common/http';
import { FieldTree, ValidationError } from '@angular/forms/signals';

import { FieldProblem, PROBLEM, toProblemDetails } from '../../core/http/problem-details';

export interface MaterialFormModel {
  readonly name: string;
  /**
   * The id of the `AppProductMaterial` this row started as, when editing — carried alongside the
   * row itself (not reconciled by position at submit time) precisely so removing an earlier row
   * can never shift this id onto the wrong one. Absent for a row the user added in this session,
   * and always absent in `create` mode, which has no prior materials to reuse.
   */
  readonly id?: string;
}

export interface ComponentFormModel {
  readonly name: string;
  readonly materials: MaterialFormModel[];
  /** Same idea as `MaterialFormModel.id`, one level up. */
  readonly id?: string;
}

export interface ProductFormModel {
  readonly name: string;
  readonly components: ComponentFormModel[];
}

const GENERIC_MESSAGE = 'خطایی غیرمنتظره رخ داد. دوباره تلاش کنید.';

/**
 * The two composition invariants a product must never violate — at least one component, and every
 * component carrying at least one material. Used inside the form's schema (`validate(path, ...)`),
 * which is what keeps the single root-level error banner in sync the moment a row is removed,
 * without waiting for a submit attempt. Exported separately so it is testable output-based, with
 * no `FieldTree` involved.
 */
export function validateProductComposition(model: ProductFormModel): ValidationError | undefined {
  if (model.components.length === 0) {
    return { kind: 'noComponents', message: 'هر محصول باید حداقل یک جز داشته باشد.' };
  }

  const componentWithNoMaterials = model.components.find(
    (component) => component.materials.length === 0,
  );
  if (componentWithNoMaterials !== undefined) {
    return {
      kind: 'noMaterials',
      message: `هر جز باید حداقل یک مواد اولیه داشته باشد. جز «${componentWithNoMaterials.name}» هیچ مواد اولیه‌ای ندارد.`,
    };
  }

  return undefined;
}

/**
 * Turns whatever the products gateway threw into the errors `submit()` applies to a create or edit
 * form. Branches on `type`, never `detail` — see `core/http/problem-details.ts`. Every message here
 * is written client-side in Persian; none of it echoes anything the API sent.
 */
export function mapProductFormError(
  error: unknown,
  form: FieldTree<ProductFormModel>,
): readonly ValidationError.WithOptionalFieldTree[] {
  // Checked by status rather than by `type`, because the contract's 403 response carries no `type`
  // member at all. Any 403 here means the caller's permissions changed mid-session; the backend is
  // what actually enforced it.
  if (error instanceof HttpErrorResponse && error.status === 403) {
    return [rootError('شما اجازهٔ انجام این عملیات را ندارید.')];
  }

  const problem = toProblemDetails(error);
  if (problem === undefined) {
    return [rootError('خطایی در برقراری ارتباط با سرور رخ داد. دوباره تلاش کنید.')];
  }

  if (problem.type === PROBLEM.validationError) {
    return (problem.errors ?? []).map((fieldError) => toFieldError(fieldError, form));
  }

  // The client-side schema already blocks a submit that would violate either invariant — see
  // `validateProductComposition` — so these two cases are a defensive fallback, not the primary
  // path. Both are root-level, mirroring the client-side check they duplicate.
  if (problem.type === PROBLEM.productMustHaveAtLeastOneComponent) {
    return [rootError('هر محصول باید حداقل یک جز داشته باشد.')];
  }

  if (problem.type === PROBLEM.productComponentMustHaveAtLeastOneMaterial) {
    return [rootError('هر جز باید حداقل یک مواد اولیه داشته باشد.')];
  }

  if (problem.type === PROBLEM.componentNameAlreadyExists) {
    return [
      targetComponentNameOrRoot(form, problem.name, 'این نام قبلاً برای جز دیگری ثبت شده است.'),
    ];
  }

  if (problem.type === PROBLEM.materialNameAlreadyExists) {
    return [
      targetMaterialNameOrRoot(
        form,
        problem.name,
        'این نام قبلاً برای مواد اولیهٔ دیگری ثبت شده است.',
      ),
    ];
  }

  if (problem.type === PROBLEM.entityNotFound) {
    return [rootError('این محصول دیگر وجود ندارد. فهرست را تازه‌سازی کنید.')];
  }

  return [rootError(GENERIC_MESSAGE)];
}

const FIELD_MESSAGES: Readonly<Record<string, string>> = {
  name: 'نام نمی‌تواند خالی باشد.',
};

function toFieldError(
  fieldError: FieldProblem,
  form: FieldTree<ProductFormModel>,
): ValidationError.WithOptionalFieldTree {
  const message =
    (fieldError.field !== undefined ? FIELD_MESSAGES[fieldError.field] : undefined) ??
    GENERIC_MESSAGE;

  switch (fieldError.field) {
    case 'name':
      return { fieldTree: form.name, kind: 'server', message };
    default:
      // Nested component/material names are also validated server-side, but the client-side
      // `required()` rules on every row already block a submit carrying an empty one — see
      // `product-form-dialog.ts`. There is no reliable field path to target here (the backend
      // reports the array property, not an index), so this falls through to the form root.
      return rootError(message);
  }
}

/** Finds the component sharing the conflicting name and targets its own field; falls back to the
 * form root when no row matches (e.g. the row was renamed again before the response arrived). */
function targetComponentNameOrRoot(
  form: FieldTree<ProductFormModel>,
  name: string | undefined,
  message: string,
): ValidationError.WithOptionalFieldTree {
  const components = form().value().components;
  const index =
    name === undefined ? -1 : components.findIndex((component) => component.name === name);

  return index === -1
    ? rootError(message)
    : { fieldTree: form.components[index].name, kind: 'server', message };
}

/** Same idea as `targetComponentNameOrRoot`, one level down. */
function targetMaterialNameOrRoot(
  form: FieldTree<ProductFormModel>,
  name: string | undefined,
  message: string,
): ValidationError.WithOptionalFieldTree {
  const components = form().value().components;

  if (name !== undefined) {
    for (let componentIndex = 0; componentIndex < components.length; componentIndex += 1) {
      const materialIndex = components[componentIndex].materials.findIndex(
        (material) => material.name === name,
      );
      if (materialIndex !== -1) {
        return {
          fieldTree: form.components[componentIndex].materials[materialIndex].name,
          kind: 'server',
          message,
        };
      }
    }
  }

  return rootError(message);
}

function rootError(message: string): ValidationError.WithOptionalFieldTree {
  return { kind: 'server', message };
}

/** Turns whatever `ProductsGateway.delete` threw into the message the delete-confirmation dialog shows. */
export function mapDeleteError(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 403) {
    return 'شما اجازهٔ انجام این عملیات را ندارید.';
  }

  const problem = toProblemDetails(error);
  if (problem?.type === PROBLEM.entityNotFound) {
    return 'این محصول پیش‌تر حذف شده است. فهرست را تازه‌سازی کنید.';
  }

  return 'حذف محصول ممکن نشد. دوباره تلاش کنید.';
}
