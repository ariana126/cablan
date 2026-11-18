import { DomainEvent } from '@framework/domain';

/**
 * A product's components laid out in another order, each with its own
 * materials, nothing else changed (issue #122). Recorded instead of
 * `ProductComponentsUpdated` for a pure reordering.
 *
 * `previousOrder`/`newOrder` are the component names as the product recorded
 * them, for the audit entry; `componentIds` is the new order by id, for the
 * snapshots that follow it.
 */
export class ProductComponentsReordered implements DomainEvent {
  constructor(
    public readonly productId: string,
    public readonly previousOrder: string[],
    public readonly newOrder: string[],
    public readonly componentIds: string[],
  ) {}
}
