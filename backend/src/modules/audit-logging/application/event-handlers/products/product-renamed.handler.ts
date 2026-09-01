import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { ProductRenamed } from '@products/domain/events/product-renamed.event';

@EventsHandler(ProductRenamed)
export class ProductRenamedAuditHandler implements IEventHandler<ProductRenamed> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: ProductRenamed): Promise<void> {
    await this.projector.project(
      AuditRecordType.Product,
      event.productId,
      AuditAction.Edited,
      [
        {
          field: 'name',
          previousValue: event.previousName,
          newValue: event.newName,
        },
      ],
    );
  }
}
