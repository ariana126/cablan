import { QuestionAdapter, Task } from '@serenity-js/core';
import { GetRequest, LastResponse, Send } from '@serenity-js/rest';

/**
 * Confirmed against `backend/src/modules/components/application/queries/list-components/
 * component.read-model.ts` (`ComponentReadModel { id, name }`) and its controller's
 * `@ApiOkResponse` schema — unlike most of this module's peers when this feature area was first
 * automated, the backend's `components` module already exists.
 */
export interface ComponentSummary {
  id: string;
  name: string;
}

export const ViewComponentList = (): Task =>
  Task.where(
    '#actor views the component list',
    Send.a(GetRequest.to('components')),
  );

/** The list from the last `ViewComponentList()` — call that first. */
export const TheComponentList = (): QuestionAdapter<ComponentSummary[]> =>
  LastResponse.body<ComponentSummary[]>();
