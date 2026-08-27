import { QuestionAdapter, Task } from '@serenity-js/core';
import { GetRequest, LastResponse, Send } from '@serenity-js/rest';

/**
 * Matches the dispatch's best-guess HTTP surface for `GET /api/boms` — no `boms` backend module
 * exists yet at the time this was written (it's being built in parallel against the same
 * dispatch), so this is a contract to build against, not a confirmed one, mirroring
 * `screenplay/bom-registration/view-standard-bom-list.ts#StandardBomSummary`.
 */
export interface MaterialInBomComponentSummary {
  id: string;
  name: string;
  weight: number;
}

export interface ComponentInBomSummary {
  id: string;
  name: string;
  materials: MaterialInBomComponentSummary[];
}

export interface BomSummary {
  id: string;
  orderNumber: string;
  trackingNumber: string;
  description?: string;
  standardBomId: string;
  components: ComponentInBomSummary[];
}

export const ViewBomList = (): Task =>
  Task.where('#actor views the daily BOM list', Send.a(GetRequest.to('boms')));

/** The list from the last `ViewBomList()` — call that first. */
export const TheBomList = (): QuestionAdapter<BomSummary[]> =>
  LastResponse.body<BomSummary[]>();
