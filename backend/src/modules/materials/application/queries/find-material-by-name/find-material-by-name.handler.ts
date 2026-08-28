import { MaterialRepository } from '@materials/domain/service/material.repository';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { FindMaterialByNameQuery } from './find-material-by-name.query';

@QueryHandler(FindMaterialByNameQuery)
export class FindMaterialByNameHandler implements IQueryHandler<FindMaterialByNameQuery> {
  constructor(private readonly materialRepository: MaterialRepository) {}

  async execute(
    query: FindMaterialByNameQuery,
  ): Promise<{ id: string; name: string } | undefined> {
    const material = await this.materialRepository.findByName(query.name);
    return material
      ? { id: material.id.asString(), name: material.name().asString() }
      : undefined;
  }
}
