import { QuestionAdapter, Task } from '@serenity-js/core';
import { GetRequest, LastResponse, Send } from '@serenity-js/rest';

/**
 * ASSUMPTION: the shape of `GET /api/materials`'s read model — mirrors the dispatch's HTTP
 * surface ("`GET /api/materials` (list)") and the identity module's `UserReadModel` convention
 * (`id`, plus whatever a material actually is: a `name`). No `materials` backend module exists
 * yet at the time this was written, so this is a contract to build against, not a confirmed one.
 */
export interface MaterialSummary {
  id: string;
  name: string;
}

export const ViewMaterialList = (): Task =>
  Task.where(
    '#actor views the material list',
    Send.a(GetRequest.to('materials')),
  );

/** The list from the last `ViewMaterialList()` — call that first. */
export const TheMaterialList = (): QuestionAdapter<MaterialSummary[]> =>
  LastResponse.body<MaterialSummary[]>();
