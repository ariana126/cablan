import { QuestionAdapter, Task } from '@serenity-js/core';
import { GetRequest, LastResponse, Send } from '@serenity-js/rest';

/**
 * Matches the dispatch's best-guess HTTP surface for `GET /api/standard-boms` — no `standard-boms`
 * backend module exists yet at the time this was written (it's being built in parallel against the
 * same dispatch), so this is a contract to build against, not a confirmed one, mirroring
 * `screenplay/bom-registration/view-product-list.ts#ProductSummary`.
 */
export interface MaterialInStandardBomComponentSummary {
  id: string;
  name: string;
  weight: number;
}

export interface ComponentInStandardBomSummary {
  id: string;
  name: string;
  materials: MaterialInStandardBomComponentSummary[];
}

export interface StandardBomSummary {
  id: string;
  miCode: string;
  brand: string;
  standardLength: number;
  active: boolean;
  description?: string;
  productId: string;
  components: ComponentInStandardBomSummary[];
}

export const ViewStandardBomList = (): Task =>
  Task.where(
    '#actor views the standard BOM list',
    Send.a(GetRequest.to('standard-boms')),
  );

/** The list from the last `ViewStandardBomList()` — call that first. */
export const TheStandardBomList = (): QuestionAdapter<StandardBomSummary[]> =>
  LastResponse.body<StandardBomSummary[]>();
