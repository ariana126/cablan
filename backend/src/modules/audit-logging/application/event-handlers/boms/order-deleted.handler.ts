import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { OrderDeleted } from '@boms/domain/events/order-deleted.event';
import {
  DomainEventHandler,
  DomainEventHandlerOf,
} from '@framework/application';

@DomainEventHandler(OrderDeleted)
export class OrderDeletedAuditHandler implements DomainEventHandlerOf<OrderDeleted> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: OrderDeleted): Promise<void> {
    await this.projector.project(
      AuditRecordType.Order,
      event.orderId,
      AuditAction.Deleted,
      [
        {
          field: 'orderNumber',
          previousValue: event.snapshot.orderNumber,
          newValue: '',
        },
        ...event.snapshot.miCodes.map(({ miCode }) => ({
          field: 'miCode',
          previousValue: miCode,
          newValue: '',
        })),
      ],
    );
  }
}
