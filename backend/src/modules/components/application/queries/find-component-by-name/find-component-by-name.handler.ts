import { ComponentRepository } from '@components/domain/service/component.repository';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { FindComponentByNameQuery } from './find-component-by-name.query';

@QueryHandler(FindComponentByNameQuery)
export class FindComponentByNameHandler implements IQueryHandler<FindComponentByNameQuery> {
  constructor(private readonly componentRepository: ComponentRepository) {}

  async execute(
    query: FindComponentByNameQuery,
  ): Promise<{ id: string; name: string } | undefined> {
    const component = await this.componentRepository.findByName(query.name);
    return component
      ? { id: component.id.asString(), name: component.name().asString() }
      : undefined;
  }
}
