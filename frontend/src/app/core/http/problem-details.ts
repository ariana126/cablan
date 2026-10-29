import { HttpErrorResponse } from '@angular/common/http';

/**
 * The problem types the API emits, as they appear in a response's `type` member. The backend builds
 * these from a `TYPE_BASE_URL` constant of its own; this is the client's copy of the same vocabulary.
 *
 * They are URIs, not URLs — nothing dereferences them. They are identifiers, and comparing against
 * them is how the client tells one failure from another.
 */
export const PROBLEM = {
  validationError: 'https://my-api-doc.dev/problems/validation-error',
  userAlreadyExists: 'https://my-api-doc.dev/problems/user-already-exists',
  invalidCredentials: 'https://my-api-doc.dev/problems/invalid-credentials',
  entityNotFound: 'https://my-api-doc.dev/problems/entity-not-found',
  /** `POST /api/users` — the chosen username is already taken by another account. */
  usernameAlreadyExists: 'https://my-api-doc.dev/problems/username-already-exists',
  /** `PATCH /api/users/{id}` — a System Admin targeted their own id with a `role` field present. */
  cannotChangeOwnRole: 'https://my-api-doc.dev/problems/cannot-change-own-role',
  /** `POST /api/password-resets` — nobody is registered with that address. */
  userNotFound: 'https://my-api-doc.dev/problems/user-not-found',
  /** `PUT /api/password-resets/{token}/password` — the link matches no reset on record. */
  passwordResetNotFound: 'https://my-api-doc.dev/problems/password-reset-not-found',
  /** The reset's window has closed. */
  passwordResetExpired: 'https://my-api-doc.dev/problems/password-reset-expired',
  /**
   * The reset was already spent on a password change.
   *
   * This one shares its 410 with `passwordResetExpired`, and OpenAPI can only carry one example
   * per status, so `api/openapi.json` documents the expired case alone. The type is real and the
   * API emits it; this constant is the client's own vocabulary, not a projection of the spec.
   */
  passwordResetAlreadyUsed: 'https://my-api-doc.dev/problems/password-reset-already-used',
  /** `POST /api/materials`, `PATCH /api/materials/{id}` — the chosen name is already in use. */
  materialNameAlreadyExists: 'https://my-api-doc.dev/problems/material-name-already-exists',
  /** `POST /api/materials`, `PATCH /api/materials/{id}` — the chosen code is already in use. */
  materialCodeAlreadyExists: 'https://my-api-doc.dev/problems/material-code-already-exists',
  /** `POST /api/components`, `PATCH /api/components/{id}` — the chosen name is already in use. */
  componentNameAlreadyExists: 'https://my-api-doc.dev/problems/component-name-already-exists',
  /** `POST /api/products`, `PATCH /api/products/{id}` — the submitted product has no components. */
  productMustHaveAtLeastOneComponent:
    'https://my-api-doc.dev/problems/product-must-have-at-least-one-component',
  /** `POST /api/products`, `PATCH /api/products/{id}` — one of the submitted components has no materials. */
  productComponentMustHaveAtLeastOneMaterial:
    'https://my-api-doc.dev/problems/product-component-must-have-at-least-one-material',
  /** `POST /api/products`, `PATCH /api/products/{id}` — a component name in the request doesn't
   * resolve to an already-registered `Component` row (see `backend/src/modules/products/CLAUDE.md`'s
   * "The one place this module crosses another module's boundary"). */
  componentNotRegistered: 'https://my-api-doc.dev/problems/component-not-registered',
  /** `POST /api/products`, `PATCH /api/products/{id}` — a material name in the request doesn't
   * resolve to an already-registered `Material` row. */
  materialNotRegistered: 'https://my-api-doc.dev/problems/material-not-registered',
  /** `POST /api/standard-boms`, `PATCH /api/standard-boms/{id}` — the chosen MI code is already in use. */
  standardBomMiCodeAlreadyExists:
    'https://my-api-doc.dev/problems/standard-bom-mi-code-already-exists',
  /** `POST /api/standard-boms`, `PATCH /api/standard-boms/{id}` — the submitted standard BOM has no components. */
  standardBomMustHaveAtLeastOneComponent:
    'https://my-api-doc.dev/problems/standard-bom-must-have-at-least-one-component',
  /** `POST /api/standard-boms`, `PATCH /api/standard-boms/{id}` — one of the submitted components has no materials. */
  standardBomComponentMustHaveAtLeastOneMaterial:
    'https://my-api-doc.dev/problems/standard-bom-component-must-have-at-least-one-material',
  /** `POST /api/standard-boms`, `PATCH /api/standard-boms/{id}` — the request's own `productId` does not resolve to an existing product. */
  standardBomProductNotFound: 'https://my-api-doc.dev/problems/standard-bom-product-not-found',
  /** `POST /api/standard-boms`, `PATCH /api/standard-boms/{id}` — a chosen `(componentId, materialId)` pair isn't part of the referenced product's current composition. */
  standardBomCompositionEntryNotFound:
    'https://my-api-doc.dev/problems/standard-bom-composition-entry-not-found',
  /** `POST /api/boms`, `PATCH /api/boms/{id}` — the submitted daily BOM has no components. */
  bomMustHaveAtLeastOneComponent:
    'https://my-api-doc.dev/problems/bom-must-have-at-least-one-component',
  /** `POST /api/boms`, `PATCH /api/boms/{id}` — one of the submitted components has no materials. */
  bomComponentMustHaveAtLeastOneMaterial:
    'https://my-api-doc.dev/problems/bom-component-must-have-at-least-one-material',
  /** `POST /api/boms`, `PATCH /api/boms/{id}` — the request's own `standardBomMiCode` does not resolve to an existing standard BOM. */
  bomStandardBomNotFound: 'https://my-api-doc.dev/problems/bom-standard-bom-not-found',
  /** `POST /api/boms`, `PATCH /api/boms/{id}` — a chosen `(componentId, materialId)` pair isn't part of the referenced standard BOM's current composition. */
  bomCompositionEntryNotFound: 'https://my-api-doc.dev/problems/bom-composition-entry-not-found',
  /** `POST /api/boms/{id}/rejection` — the reason is missing, empty or only whitespace. */
  rejectionReasonRequired: 'https://my-api-doc.dev/problems/rejection-reason-required',
  /** `POST /api/boms/{id}/approval`, `POST /api/boms/{id}/rejection` — the daily BOM is already
   * approved or rejected; only an edit sends it back to pending for another review. */
  bomAlreadyReviewed: 'https://my-api-doc.dev/problems/bom-already-reviewed',
  /** `POST /api/boms/{id}/resampling` — the daily BOM is not the latest of its tracking number, or
   * is not rejected; someone may have re-sampled it first. */
  bomNotResamplable: 'https://my-api-doc.dev/problems/bom-not-resamplable',
  /** `PATCH /api/boms/{id}` — the edit changes something but its `editReason` is missing, empty or
   * only whitespace; nothing was changed. A save that changes nothing needs no reason. */
  editReasonRequired: 'https://my-api-doc.dev/problems/edit-reason-required',
  /** `POST /api/materials/import-preview` — not a readable .xlsx, or no header row naming both
   * «کد کالا» and «نام کالا». */
  materialImportFileUnreadable: 'https://my-api-doc.dev/problems/material-import-file-unreadable',
  /** `POST /api/materials/imports` — a kept row has errors; the `rows` extension lists them and
   * nothing was written. */
  materialImportHasInvalidRows: 'https://my-api-doc.dev/problems/material-import-has-invalid-rows',
  /** `POST /api/materials/imports` — no kept row changes anything. */
  materialImportEmpty: 'https://my-api-doc.dev/problems/material-import-empty',
  /** `POST /api/materials/imports/{id}/reversion` — no such import. */
  materialImportNotFound: 'https://my-api-doc.dev/problems/material-import-not-found',
  /** `POST /api/materials/imports/{id}/reversion` — a later, not-reverted import exists. */
  materialImportNotLatest: 'https://my-api-doc.dev/problems/material-import-not-latest',
  /** `POST /api/materials/imports/{id}/reversion` — a material it touched has since changed or been
   * used, or a name or code it would restore is now taken. */
  materialImportNotRevertible: 'https://my-api-doc.dev/problems/material-import-not-revertible',
  /** `POST /api/materials/imports/{id}/reversion` — already reverted. */
  materialImportAlreadyReverted: 'https://my-api-doc.dev/problems/material-import-already-reverted',
  /** `POST /api/equipment`, `PATCH /api/equipment/{id}` — another piece of equipment has the name. */
  equipmentNameTaken: 'https://my-api-doc.dev/problems/equipment-name-taken',
  /** `POST /api/maintenance-activities`, `PATCH …/{id}` — another activity has the name. */
  maintenanceActivityNameTaken: 'https://my-api-doc.dev/problems/maintenance-activity-name-taken',
  /** `POST /api/equipment/{id}/pm-plan-items` — the activity is already active in this plan. */
  activityAlreadyInPmPlan: 'https://my-api-doc.dev/problems/activity-already-in-pm-plan',
  /** `POST /api/equipment/{id}/pm-plan-items` — an interval in operating hours, which the plan
   * does not take yet. The UI only ever sends days. */
  usageBasedIntervalNotSupported:
    'https://my-api-doc.dev/problems/usage-based-interval-not-supported',
  /** Any write against retired equipment — its plan stopped when it was retired. */
  equipmentRetired: 'https://my-api-doc.dev/problems/equipment-retired',
  /** Any write against a plan item already removed from its plan. */
  pmPlanItemRemoved: 'https://my-api-doc.dev/problems/pm-plan-item-removed',
  /** `POST …/pm-plan-items/{itemId}/executions` — that occurrence was recorded meanwhile. */
  pmOccurrenceAlreadyRecorded: 'https://my-api-doc.dev/problems/pm-occurrence-already-recorded',
} as const;

/** One entry of a validation error's `errors` array. `field` matches the DTO property name. */
export interface FieldProblem {
  readonly field?: string;
  readonly message?: string;
}

/**
 * An RFC 9457 problem document. Only `type` is guaranteed present — the backend's `ProblemDetail`
 * always emits `type`, `title` and `status`, and spreads `detail`, `instance` and extension members
 * only when they are defined.
 *
 * **Branch on `type`, never on `detail`.** `detail` is optional per RFC 9457 and its wording belongs
 * to the server; `type` is the stable identifier. Clients should assert on `type` for the same
 * reason.
 */
export interface ProblemDetails {
  readonly type: string;
  readonly title?: string;
  readonly status?: number;
  readonly detail?: string;
  /** `validation-error` only. */
  readonly errors?: readonly FieldProblem[];
  /** `user-already-exists` only. */
  readonly email?: string;
  /** `component-name-already-exists`, `material-name-already-exists` only — the colliding name. */
  readonly name?: string;
  /** `product-component-must-have-at-least-one-material`, `component-not-registered` — the
   * offending/attempted component's name. */
  readonly componentName?: string;
  /** `material-not-registered` only — the attempted material's name. */
  readonly materialName?: string;
  /** `material-import-has-invalid-rows` only — each refused row with its error codes. */
  readonly rows?: readonly InvalidImportRowProblem[];
}

/** One entry of `material-import-has-invalid-rows`'s `rows`. */
export interface InvalidImportRowProblem {
  readonly row?: number;
  readonly name?: string;
  readonly code?: string;
  readonly errors?: readonly string[];
}

/**
 * Narrows an unknown thrown value to a problem document, or `undefined` when it is not one.
 *
 * Everything a caller can be handed goes through here, and most of it is not a problem document: a
 * network failure (`status: 0`, `error` is a `ProgressEvent`), an HTML error page from a proxy, or a
 * plain `Error` thrown by our own code. `HttpClient` parses a JSON body into `error` regardless of
 * the `application/problem+json` content type, so the guard has to be on the shape rather than the
 * header.
 */
export function toProblemDetails(error: unknown): ProblemDetails | undefined {
  if (!(error instanceof HttpErrorResponse)) {
    return undefined;
  }

  const body: unknown = error.error;
  if (typeof body !== 'object' || body === null) {
    return undefined;
  }

  // A network failure hands us a `ProgressEvent`, and `Event.type` is a string — `'error'`. That
  // collides exactly with the member we key off, so a shape check alone would happily report a
  // dropped connection as a problem document of type "error". Rule out events explicitly.
  if (body instanceof Event) {
    return undefined;
  }

  const type: unknown = (body as { type?: unknown }).type;
  return typeof type === 'string' ? (body as ProblemDetails) : undefined;
}
