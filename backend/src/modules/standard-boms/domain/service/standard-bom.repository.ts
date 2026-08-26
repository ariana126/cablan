import { EntityRepository } from '@framework/domain';

import { StandardBom } from '../standard-bom.aggregate';
import { MiCode } from '../value/mi-code.vo';

export abstract class StandardBomRepository extends EntityRepository<StandardBom> {
  abstract findByMiCode(miCode: MiCode): Promise<StandardBom | null>;

  abstract list(): Promise<StandardBom[]>;

  /**
   * Hard delete: nothing yet references a standard BOM, so the row is
   * removed outright rather than kept behind a flag — mirroring
   * `ProductRepository`.
   */
  abstract delete(standardBom: StandardBom): Promise<void>;
}
