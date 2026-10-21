import { QuestionAdapter, Task } from '@serenity-js/core';
import { GetRequest, LastResponse, Send } from '@serenity-js/rest';

/**
 * The shape of `GET /api/materials`'s read model: `id`, `name` and `code`. `code` is required on
 * every material since issue #51; it is typed as possibly `null` only so a material that somehow
 * still has none reads as "blank" rather than crashing a comparison.
 */
export interface MaterialSummary {
  id: string;
  name: string;
  code: string | null;
}

export const ViewMaterialList = (): Task =>
  Task.where(
    '#actor views the material list',
    Send.a(GetRequest.to('materials')),
  );

/** The list from the last `ViewMaterialList()` — call that first. */
export const TheMaterialList = (): QuestionAdapter<MaterialSummary[]> =>
  LastResponse.body<MaterialSummary[]>();
