import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { OrderEdited } from '@boms/domain/events/order-edited.event';
import {
  DomainEventHandler,
  DomainEventHandlerOf,
} from '@framework/application';

// `orderNumber` and/or `miCodes` (the list before and after, `, `-joined).
@DomainEventHandler(OrderEdited)
export class OrderEditedAuditHandler implements DomainEventHandlerOf<OrderEdited> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: OrderEdited): Promise<void> {
    await this.projector.project(
      AuditRecordType.Order,
      event.orderId,
      AuditAction.Edited,
      [...event.changes],
    );
  }
}
