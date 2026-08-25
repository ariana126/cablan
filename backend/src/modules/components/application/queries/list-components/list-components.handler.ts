import { ComponentRepository } from '@components/domain/service/component.repository';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

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
