import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { OrderMiCodeAdded } from '@boms/domain/events/order-mi-code-added.event';
import {
  DomainEventHandler,
  DomainEventHandlerOf,
} from '@framework/application';

@DomainEventHandler(OrderMiCodeAdded)
export class OrderMiCodeAddedAuditHandler implements DomainEventHandlerOf<OrderMiCodeAdded> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: OrderMiCodeAdded): Promise<void> {
    await this.projector.project(
      AuditRecordType.Order,
      event.orderId,
      AuditAction.Edited,
      [{ field: 'miCode', previousValue: '', newValue: event.miCode }],
    );
  }
}
