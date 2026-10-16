import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { AuditSnapshot } from '@audit-logging/application/service/audit-snapshot';
import {
  DomainEventHandler,
  DomainEventHandlerOf,
} from '@framework/application';
import { ProductRegistered } from '@products/domain/events/product-registered.event';

@DomainEventHandler(ProductRegistered)
export class ProductRegisteredAuditHandler implements DomainEventHandlerOf<ProductRegistered> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: ProductRegistered): Promise<void> {
    await this.projector.project(
      AuditRecordType.Product,
      event.productId,
      AuditAction.Registered,
      AuditSnapshot.of({ name: event.name }, event.components).asRegistration(),
    );
  }
}
