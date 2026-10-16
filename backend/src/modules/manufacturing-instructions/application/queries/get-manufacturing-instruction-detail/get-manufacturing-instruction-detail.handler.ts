import { EntityNotFound, Identity } from '@framework/domain';
import { ManufacturingInstructionRepository } from '@manufacturing-instructions/domain/service/manufacturing-instruction.repository';
import { MiCode } from '@manufacturing-instructions/domain/value/mi-code.vo';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { GetManufacturingInstructionDetailQuery } from './get-manufacturing-instruction-detail.query';
import {
  ManufacturingInstructionDetail,
  ManufacturingInstructionDetailComponentItem,
  ManufacturingInstructionDetailMaterialItem,
} from './manufacturing-instruction-detail.read-model';

@QueryHandler(GetManufacturingInstructionDetailQuery)
export class GetManufacturingInstructionDetailHandler implements IQueryHandler<GetManufacturingInstructionDetailQuery> {
  constructor(
    private readonly manufacturingInstructionRepository: ManufacturingInstructionRepository,
  ) {}

  async execute(
    query: GetManufacturingInstructionDetailQuery,
  ): Promise<ManufacturingInstructionDetail> {
    const manufacturingInstruction =
      await this.manufacturingInstructionRepository.findByMiCode(
        MiCode.fromString(query.miCode),
      );
    if (!manufacturingInstruction) {
      throw EntityNotFound.withId(Identity.fromString(query.miCode));
    }

    let totalWeight = 0;
    const components = manufacturingInstruction
      .components()
      .map((component) => {
        const materials = component.materials().map((material) => {
          totalWeight += material.weight().asGrams();
          return new ManufacturingInstructionDetailMaterialItem(
            material.materialId().asString(),
            material.name(),
            material.weight().asGrams(),
          );
        });
        return new ManufacturingInstructionDetailComponentItem(
          component.componentId().asString(),
          component.name(),
          materials,
        );
      });

    return new ManufacturingInstructionDetail(
      manufacturingInstruction.id.asString(),
      manufacturingInstruction.miCode().asString(),
      manufacturingInstruction.brand().asString(),
      manufacturingInstruction.productName(),
      manufacturingInstruction.standardLength().asNumber(),
      manufacturingInstruction.active(),
      manufacturingInstruction.description() ?? null,
      components,
      totalWeight,
    );
  }
}
