import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { ProductDeleted } from '@products/domain/events/product-deleted.event';

@EventsHandler(ProductDeleted)
export class ProductDeletedAuditHandler implements IEventHandler<ProductDeleted> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: ProductDeleted): Promise<void> {
    await this.projector.project(
      AuditRecordType.Product,
      event.productId,
      AuditAction.Deleted,
    );
  }
}
