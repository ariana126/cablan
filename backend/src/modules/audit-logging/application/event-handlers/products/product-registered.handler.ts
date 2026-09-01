import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { ProductRegistered } from '@products/domain/events/product-registered.event';

@EventsHandler(ProductRegistered)
export class ProductRegisteredAuditHandler implements IEventHandler<ProductRegistered> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: ProductRegistered): Promise<void> {
    await this.projector.project(
      AuditRecordType.Product,
      event.productId,
      AuditAction.Registered,
    );
  }
}
