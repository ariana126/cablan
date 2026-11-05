import { HttpErrorResponse } from '@angular/common/http';
import { FieldTree, ValidationError } from '@angular/forms/signals';

import { EDIT_REASON_REQUIRED } from '../../core/boms/bom-edit-history';
import { FieldProblem, PROBLEM, toProblemDetails } from '../../core/http/problem-details';
import { recordHasDependentsMessage } from '../../core/http/record-has-dependents';

export interface BomMaterialLineFormModel {
  /** The id of the `AppStandardBomMaterial` this line clones — always present, since a material
   * line is never freely typed by the user; it is always one of the chosen standard BOM's own
   * current materials. */
  readonly materialId: string;
  readonly name: string;
  readonly weight: number;
}

export interface BomComponentLineFormModel {
  /** Same idea as `BomMaterialLineFormModel.materialId`, one level up. */
  readonly componentId: string;
  readonly name: string;
  readonly materials: BomMaterialLineFormModel[];
}

export interface BomFormModel {
  readonly standardBomMiCode: string;
  readonly orderNumber: string;
  readonly trackingNumber: string;
  readonly description: string;
  /** «دلیل ویرایش» — edit mode only; registration and re-sampling never send it. */
  readonly editReason: string;
  readonly components: BomComponentLineFormModel[];
}

const GENERIC_MESSAGE = 'خطایی غیرمنتظره رخ داد. دوباره تلاش کنید.';

/** «کد MI» left unchosen — client-side and as the API's validation error alike. */
export const MI_CODE_REQUIRED = 'کد MI را انتخاب کنید.';

/** No MI code, and «کد MI» has none to offer: the order number has to name a defined order first. */
export const ORDER_FIRST = 'ابتدا شماره سفارشی تعریف‌شده را وارد کنید تا کد MI آن را انتخاب کنید.';

const FIELD_MESSAGES: Readonly<Record<string, string>> = {
  standardBomMiCode: MI_CODE_REQUIRED,
  orderNumber: 'شماره سفارش را وارد کنید.',
  trackingNumber: 'شماره ردیابی را وارد کنید.',
  weight: 'وزن مواد اولیه را به صورت عدد مثبت وارد کنید.',
};

/**
 * Turns whatever the BOMs gateway threw into the errors `submit()` applies to a create or edit
 * form. Branches on `type`, never `detail` — see `core/http/problem-details.ts`. Every message here
 * is written client-side in Persian; none of it echoes anything the API sent.
 */
export function mapBomFormError(
  error: unknown,
  form: FieldTree<BomFormModel>,
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

  // Another record references this one (issue #94): say where, so the visitor knows why.
  const usedElsewhere = recordHasDependentsMessage(error, 'edit');
  if (usedElsewhere !== undefined) {
    return [rootError(usedElsewhere)];
  }

  if (problem.type === PROBLEM.validationError) {
    return (problem.errors ?? []).map((fieldError) => toFieldError(fieldError, form));
  }

  // Edit only: the edit changed something, so it needs a reason. Not checked client-side — a save
  // that changes nothing must go through without one, and only the API knows whether it did.
  if (problem.type === PROBLEM.editReasonRequired) {
    return [{ fieldTree: form.editReason, kind: 'server', message: EDIT_REASON_REQUIRED }];
  }

  // Issue #101: a daily BOM is registered for a defined order, with one of that order's MI codes.
  if (problem.type === PROBLEM.bomOrderNotDefined) {
    return [
      {
        fieldTree: form.orderNumber,
        kind: 'server',
        message: 'سفارشی با این شماره تعریف نشده است.',
      },
    ];
  }

  if (problem.type === PROBLEM.bomMiCodeRequired) {
    return [
      {
        fieldTree: form.standardBomMiCode,
        kind: 'server',
        message: 'این سفارش چند کد MI دارد؛ کد MI را انتخاب کنید.',
      },
    ];
  }

  // On edit the code must also be of the daily BOM's own product — the same refusal.
  if (problem.type === PROBLEM.bomMiCodeNotInOrder) {
    return [
      {
        fieldTree: form.standardBomMiCode,
        kind: 'server',
        message: 'این کد MI به این سفارش تخصیص داده نشده یا از محصول دیگری است.',
      },
    ];
  }

  if (problem.type === PROBLEM.bomStandardBomNotFound) {
    return [
      {
        fieldTree: form.standardBomMiCode,
        kind: 'server',
        message: 'آنالیز استانداردی با این کد MI یافت نشد. فهرست را تازه‌سازی کنید.',
      },
    ];
  }

  // The client always clones its composition from a standard BOM's current, non-empty structure —
  // see `bom-form-dialog.ts` — so these are a defensive fallback, not the primary path.
  if (problem.type === PROBLEM.bomMustHaveAtLeastOneComponent) {
    return [rootError('این آنالیز روزانه باید حداقل یک جز داشته باشد.')];
  }

  if (problem.type === PROBLEM.bomComponentMustHaveAtLeastOneMaterial) {
    return [rootError('هر جز باید حداقل یک مواد اولیه داشته باشد.')];
  }

  if (problem.type === PROBLEM.bomCompositionEntryNotFound) {
    return [
      rootError('ترکیب انتخاب‌شده دیگر با آنالیز استاندارد همخوانی ندارد. فرم را دوباره باز کنید.'),
    ];
  }

  if (problem.type === PROBLEM.entityNotFound) {
    return [rootError('این آنالیز روزانه دیگر وجود ندارد. فهرست را تازه‌سازی کنید.')];
  }

  // Re-sampling only: the daily BOM is no longer the latest rejected one of its tracking number —
  // most likely someone re-sampled it first.
  if (problem.type === PROBLEM.bomNotResamplable) {
    return [
      rootError('از این آنالیز روزانه دیگر نمی‌توان نمونه گیری مجدد کرد. فهرست را تازه‌سازی کنید.'),
    ];
  }

  return [rootError(GENERIC_MESSAGE)];
}

function toFieldError(
  fieldError: FieldProblem,
  form: FieldTree<BomFormModel>,
): ValidationError.WithOptionalFieldTree {
  const message =
    (fieldError.field !== undefined ? FIELD_MESSAGES[fieldError.field] : undefined) ??
    GENERIC_MESSAGE;

  switch (fieldError.field) {
    case 'standardBomMiCode':
      return { fieldTree: form.standardBomMiCode, kind: 'server', message };
    case 'orderNumber':
      return { fieldTree: form.orderNumber, kind: 'server', message };
    case 'trackingNumber':
      return { fieldTree: form.trackingNumber, kind: 'server', message };
    default:
      // The composition's own weights are validated client-side (`min(..., 1)`) before a submit
      // can ever reach the server, and there is no reliable field path for a nested composition
      // error the backend might still report, so a `weight` field error — and anything else
      // unrecognised — falls through to the form root.
      return rootError(message);
  }
}

function rootError(message: string): ValidationError.WithOptionalFieldTree {
  return { kind: 'server', message };
}

/** Turns whatever `BomsGateway.delete` threw into the message the delete-confirmation dialog shows. */
export function mapDeleteError(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 403) {
    return 'شما اجازهٔ انجام این عملیات را ندارید.';
  }

  const usedElsewhere = recordHasDependentsMessage(error, 'delete');
  if (usedElsewhere !== undefined) {
    return usedElsewhere;
  }

  const problem = toProblemDetails(error);
  if (problem?.type === PROBLEM.entityNotFound) {
    return 'این آنالیز روزانه پیش‌تر حذف شده است. فهرست را تازه‌سازی کنید.';
  }

  return 'حذف آنالیز روزانه ممکن نشد. دوباره تلاش کنید.';
}
