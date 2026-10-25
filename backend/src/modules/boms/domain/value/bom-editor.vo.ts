import { Role, ValueObject } from '@framework/domain';

import { mayReviewBoms } from './bom-reviewers';

/**
 * Who is editing a daily BOM, as far as `Bom.edit()` cares: whether they may
 * review daily BOMs. An edit by any reviewer is noted when the BOM is
 * approved; anyone else's edit discards the notes gathered so far.
 */
export class BomEditor extends ValueObject {
  private constructor(private readonly _isReviewer: boolean) {
    super();
  }

  /** `role` is the editor's current role; `null` for an unknown user. */
  static withRole(role: Role | null): BomEditor {
    return new BomEditor(mayReviewBoms(role));
  }

  public isReviewer(): boolean {
    return this._isReviewer;
  }
}
