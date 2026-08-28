import { FindComponentByNameHandler } from '@components/application/queries/find-component-by-name/find-component-by-name.handler';
import { ListComponentsHandler } from '@components/application/queries/list-components/list-components.handler';

export const QueryHandlers = [
  ListComponentsHandler,
  FindComponentByNameHandler,
];
