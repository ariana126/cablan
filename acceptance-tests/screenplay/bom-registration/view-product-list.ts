import { QuestionAdapter, Task } from '@serenity-js/core';
import { GetRequest, LastResponse, Send } from '@serenity-js/rest';

/**
 * Matches the dispatch's HTTP surface for `GET /api/products` — a list read model shaped like
 * `{ id, name, components: [...] }[]`, each component itself carrying its own `materials`. No
 * `products` backend module exists yet at the time this was written (it's being built in parallel
 * against the same dispatch), so this is a contract to build against, not a confirmed one — unlike
 * `screenplay/bom-registration/view-component-list.ts#ComponentSummary`, which was written against
 * an already-shipped module.
 */
export interface MaterialInComponentSummary {
  id: string;
  name: string;
}

export interface ComponentInProductSummary {
  id: string;
  name: string;
  materials: MaterialInComponentSummary[];
}

export interface ProductSummary {
  id: string;
  name: string;
  components: ComponentInProductSummary[];
}

export const ViewProductList = (): Task =>
  Task.where(
    '#actor views the product list',
    Send.a(GetRequest.to('products')),
  );

/** The list from the last `ViewProductList()` — call that first. */
export const TheProductList = (): QuestionAdapter<ProductSummary[]> =>
  LastResponse.body<ProductSummary[]>();
