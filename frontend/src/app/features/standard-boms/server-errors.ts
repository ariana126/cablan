import { HttpErrorResponse } from '@angular/common/http';
import { FieldTree, ValidationError } from '@angular/forms/signals';

import { FieldProblem, PROBLEM, toProblemDetails } from '../../core/http/problem-details';

export interface StandardBomMaterialLineFormModel {
  /** The id of the `AppProductMaterial` this line clones — always present, since a material line is
   * never freely typed by the user; it is always one of the chosen product's own current materials. */
  readonly materialId: string;
  readonly name: string;
  readonly weight: number;
}

export interface StandardBomComponentLineFormModel {
  /** Same idea as `StandardBomMaterialLineFormModel.materialId`, one level up. */
  readonly componentId: string;
  readonly name: string;
  readonly materials: StandardBomMaterialLineFormModel[];
}

export interface StandardBomFormModel {
  readonly productId: string;
  readonly miCode: string;
  readonly brand: string;
  readonly standardLength: number;
  /**
   * `''` when the user has not made a choice yet — a plain `boolean` would default to `false`,
   * indistinguishable from an explicit "غیرفعال" choice, which is exactly the distinction the
   * "must specify active on registration" rule needs. Converted to a real boolean only when
   * building the DTO to send.
   */
  readonly active: '' | 'true' | 'false';
  readonly description: string;
  readonly components: StandardBomComponentLineFormModel[];
}

const GENERIC_MESSAGE = 'خطایی غیرمنتظره رخ داد. دوباره تلاش کنید.';

const FIELD_MESSAGES: Readonly<Record<string, string>> = {
  miCode: 'کد MI را وارد کنید.',
  brand: 'برند را وارد کنید.',
  standardLength: 'متراژ استاندارد را به صورت عدد مثبت وارد کنید.',
  active: 'وضعیت فعال بودن را مشخص کنید.',
};

/**
 * Turns whatever the standard BOMs gateway threw into the errors `submit()` applies to a create or
 * edit form. Branches on `type`, never `detail` — see `core/http/problem-details.ts`. Every message
 * here is written client-side in Persian; none of it echoes anything the API sent.
 */
export function mapStandardBomFormError(
  error: unknown,
  form: FieldTree<StandardBomFormModel>,
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

  if (problem.type === PROBLEM.standardBomMiCodeAlreadyExists) {
    return [
      {
        fieldTree: form.miCode,
        kind: 'server',
        message: 'این کد MI قبلاً برای آنالیز استاندارد دیگری ثبت شده است.',
      },
    ];
  }

  // The client always clones its composition from a product's current, non-empty structure — see
  // `standard-bom-form-dialog.ts` — so these are a defensive fallback, not the primary path.
  if (problem.type === PROBLEM.standardBomMustHaveAtLeastOneComponent) {
    return [rootError('این آنالیز استاندارد باید حداقل یک جز داشته باشد.')];
  }

  if (problem.type === PROBLEM.standardBomComponentMustHaveAtLeastOneMaterial) {
    return [rootError('هر جز باید حداقل یک مواد اولیه داشته باشد.')];
  }

  if (problem.type === PROBLEM.standardBomProductNotFound) {
    return [
      {
        fieldTree: form.productId,
        kind: 'server',
        message: 'این محصول دیگر وجود ندارد. فهرست را تازه‌سازی کنید.',
      },
    ];
  }

  if (problem.type === PROBLEM.standardBomCompositionEntryNotFound) {
    return [rootError('ترکیب انتخاب‌شده دیگر با محصول همخوانی ندارد. فرم را دوباره باز کنید.')];
  }

  if (problem.type === PROBLEM.entityNotFound) {
    return [rootError('این آنالیز استاندارد دیگر وجود ندارد. فهرست را تازه‌سازی کنید.')];
  }

  return [rootError(GENERIC_MESSAGE)];
}

function toFieldError(
  fieldError: FieldProblem,
  form: FieldTree<StandardBomFormModel>,
): ValidationError.WithOptionalFieldTree {
  const message =
    (fieldError.field !== undefined ? FIELD_MESSAGES[fieldError.field] : undefined) ??
    GENERIC_MESSAGE;

  switch (fieldError.field) {
    case 'miCode':
      return { fieldTree: form.miCode, kind: 'server', message };
    case 'brand':
      return { fieldTree: form.brand, kind: 'server', message };
    case 'standardLength':
      return { fieldTree: form.standardLength, kind: 'server', message };
    case 'active':
      return { fieldTree: form.active, kind: 'server', message };
    default:
      // The composition's own weights are validated client-side (`min(..., 1)`) before a submit
      // can ever reach the server, and there is no reliable field path for a nested composition
      // error the backend might still report, so this falls through to the form root.
      return rootError(message);
  }
}

function rootError(message: string): ValidationError.WithOptionalFieldTree {
  return { kind: 'server', message };
}

/** Turns whatever `StandardBomsGateway.delete` threw into the message the delete-confirmation dialog shows. */
export function mapDeleteError(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 403) {
    return 'شما اجازهٔ انجام این عملیات را ندارید.';
  }

  const problem = toProblemDetails(error);
  if (problem?.type === PROBLEM.entityNotFound) {
    return 'این آنالیز استاندارد پیش‌تر حذف شده است. فهرست را تازه‌سازی کنید.';
  }

  return 'حذف آنالیز استاندارد ممکن نشد. دوباره تلاش کنید.';
}
