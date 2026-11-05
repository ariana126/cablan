import { EntityRepository, Identity } from '@framework/domain';

import { Bom } from '../bom.aggregate';
import { OrderNumber } from '../value/order-number.vo';

export abstract class BomRepository extends EntityRepository<Bom> {
  abstract list(): Promise<Bom[]>;

  /**
   * Every daily BOM registered for this order number — an order's daily
   * BOMs, which the System Admin's delete of the order deletes with it
   * (issue #101). A daily BOM links to its order by the number it stores.
   */
  abstract listByOrderNumber(orderNumber: OrderNumber): Promise<Bom[]>;

  /**
   * Loads the daily BOM, applies `change` to it and saves it, serialised
   * against every other `modify()` of the same BOM: the load waits until a
   * concurrent one has committed, so `change` always sees the latest state.
   * Every command that changes an existing BOM (edit, approve, reject) goes
   * through here — a plain `get()` then `save()` would let two concurrent
   * reviews both pass the "pending" check, or an approval loaded before an
   * edit overwrite it. If `change` throws, nothing is written.
   */
  abstract modify(id: Identity, change: (bom: Bom) => void): Promise<void>;

  /**
   * Whether this daily BOM is the latest of its (current) tracking number —
   * what re-sampling needs (`resamplingRefusal`). Latest is registration
   * order: `createdAt`, then the order of registration among BOMs registered
   * at the same instant (a pinned test clock), so there is always one.
   */
  abstract isLatestOfItsTrackingNumber(id: Identity): Promise<boolean>;

  /**
   * Hard delete: the row is removed outright rather than kept behind a flag
   * — mirroring `ManufacturingInstructionRepository`.
   */
  abstract delete(bom: Bom): Promise<void>;
}
