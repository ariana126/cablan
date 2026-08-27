import { EntityRepository } from '@framework/domain';

import { Bom } from '../bom.aggregate';

export abstract class BomRepository extends EntityRepository<Bom> {
  abstract list(): Promise<Bom[]>;

  /**
   * Hard delete: nothing yet references a daily BOM, so the row is removed
   * outright rather than kept behind a flag — mirroring
   * `StandardBomRepository`.
   */
  abstract delete(bom: Bom): Promise<void>;
}
