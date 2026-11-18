import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import {
  DomainEventHandler,
  DomainEventHandlerOf,
} from '@framework/application';
import { ProductComponentsReordered } from '@products/domain/events/product-components-reordered.event';

/** The Persian comma the audit lines join names with. */
const NAME_SEPARATOR = '، ';

/**
 * A product's components reordered (issue #122): an edit of the product
 * with one `componentOrder` line, the component names before and after.
 */
@DomainEventHandler(ProductComponentsReordered)
export class ProductComponentsReorderedAuditHandler implements DomainEventHandlerOf<ProductComponentsReordered> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: ProductComponentsReordered): Promise<void> {
    await this.projector.project(
      AuditRecordType.Product,
      event.productId,
      AuditAction.Edited,
      [
        {
          field: 'componentOrder',
          previousValue: event.previousOrder.join(NAME_SEPARATOR),
          newValue: event.newOrder.join(NAME_SEPARATOR),
        },
      ],
    );
  }
}
