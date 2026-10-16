import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ComponentRepository } from '@products/domain/service/component.repository';

import { ComponentReadModel } from './component.read-model';
import { ListComponentsQuery } from './list-components.query';

@QueryHandler(ListComponentsQuery)
export class ListComponentsHandler implements IQueryHandler<ListComponentsQuery> {
  constructor(private readonly componentRepository: ComponentRepository) {}

  async execute(): Promise<ComponentReadModel[]> {
    const components = await this.componentRepository.list();
    return components.map(
      (component) =>
        new ComponentReadModel(
          component.id.asString(),
          component.name().asString(),
        ),
    );
  }
}
