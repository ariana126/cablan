import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { MaterialRepository } from '@products/domain/service/material.repository';

import { ListMaterialsQuery } from './list-materials.query';
import { MaterialReadModel } from './material.read-model';

@QueryHandler(ListMaterialsQuery)
export class ListMaterialsHandler implements IQueryHandler<ListMaterialsQuery> {
  constructor(private readonly materialRepository: MaterialRepository) {}

  async execute(): Promise<MaterialReadModel[]> {
    const materials = await this.materialRepository.list();
    return materials.map(
      (material) =>
        new MaterialReadModel(
          material.id.asString(),
          material.name().asString(),
          material.code()?.asString() ?? null,
        ),
    );
  }
}
