import { EntityRepository } from '@framework/domain';

import { ManufacturingInstruction } from '../manufacturing-instruction.aggregate';
import { MiCode } from '../value/mi-code.vo';

export abstract class ManufacturingInstructionRepository extends EntityRepository<ManufacturingInstruction> {
  abstract findByMiCode(
    miCode: MiCode,
  ): Promise<ManufacturingInstruction | null>;

  abstract list(): Promise<ManufacturingInstruction[]>;

  /**
   * Hard delete: nothing yet references a standard BOM, so the row is
   * removed outright rather than kept behind a flag — mirroring
   * `ProductRepository`.
   */
  abstract delete(
    manufacturingInstruction: ManufacturingInstruction,
  ): Promise<void>;
}
