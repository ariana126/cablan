import { ApplicationException } from '@framework/application';

import { PmPlanImportErrorReadModel } from '../service/pm-plan-import-result';

// A PM plan import confirmed while its file, checked again against the
// current state, still has errors (issue #127): nothing is added. A 400
// `pm-plan-import-has-errors`, carrying every error as the preview shows it.
export class PmPlanImportHasErrors extends ApplicationException {
  private constructor(public readonly errors: PmPlanImportErrorReadModel[]) {
    super(`The PM plan file has ${errors.length} error(s); nothing was added`);
  }

  public static withErrors(
    errors: PmPlanImportErrorReadModel[],
  ): PmPlanImportHasErrors {
    return new PmPlanImportHasErrors(errors);
  }
}
