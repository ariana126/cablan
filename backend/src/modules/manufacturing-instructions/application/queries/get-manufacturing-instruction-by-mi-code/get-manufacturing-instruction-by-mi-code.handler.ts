import { EntityNotFound, Identity } from '@framework/domain';
import { ManufacturingInstructionReadModel } from '@manufacturing-instructions/application/queries/list-manufacturing-instructions/manufacturing-instruction.read-model';
import { ManufacturingInstructionRepository } from '@manufacturing-instructions/domain/service/manufacturing-instruction.repository';
import { MiCode } from '@manufacturing-instructions/domain/value/mi-code.vo';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { GetManufacturingInstructionByMiCodeQuery } from './get-manufacturing-instruction-by-mi-code.query';

// Read-side counterpart to `GetProductHandler` (see
// src/modules/products/application/queries/get-product/get-product.handler.ts):
// the one query `boms`' own `BomCompositionFactory` is allowed to dispatch
// through the `QueryBus` to read a standard BOM's current composition,
// rather than reaching into this module's repository directly.
@QueryHandler(GetManufacturingInstructionByMiCodeQuery)
export class GetManufacturingInstructionByMiCodeHandler implements IQueryHandler<GetManufacturingInstructionByMiCodeQuery> {
  constructor(
    private readonly manufacturingInstructionRepository: ManufacturingInstructionRepository,
  ) {}

  async execute(
    query: GetManufacturingInstructionByMiCodeQuery,
  ): Promise<ManufacturingInstructionReadModel> {
    const miCode = MiCode.fromString(query.miCode);
    const manufacturingInstruction =
      await this.manufacturingInstructionRepository.findByMiCode(miCode);
    if (!manufacturingInstruction) {
      throw EntityNotFound.withId(Identity.fromString(query.miCode));
    }
    return ManufacturingInstructionReadModel.fromDomain(
      manufacturingInstruction,
    );
  }
}
