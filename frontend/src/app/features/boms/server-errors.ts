import { HttpErrorResponse } from '@angular/common/http';
import { FieldTree, ValidationError } from '@angular/forms/signals';

import { FieldProblem, PROBLEM, toProblemDetails } from '../../core/http/problem-details';

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
  readonly components: BomComponentLineFormModel[];
}

const GENERIC_MESSAGE = 'خطایی غیرمنتظره رخ داد. دوباره تلاش کنید.';

const FIELD_MESSAGES: Readonly<Record<string, string>> = {
  standardBomMiCode: 'کد MI آنالیز استاندارد را انتخاب کنید.',
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

  if (problem.type === PROBLEM.validationError) {
    return (problem.errors ?? []).map((fieldError) => toFieldError(fieldError, form));
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

  const problem = toProblemDetails(error);
  if (problem?.type === PROBLEM.entityNotFound) {
    return 'این آنالیز روزانه پیش‌تر حذف شده است. فهرست را تازه‌سازی کنید.';
  }

  return 'حذف آنالیز روزانه ممکن نشد. دوباره تلاش کنید.';
}
