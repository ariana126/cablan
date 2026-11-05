import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { OrderDefined } from '@boms/domain/events/order-defined.event';
import {
  DomainEventHandler,
  DomainEventHandlerOf,
} from '@framework/application';

// The order number, then one `miCode` line per MI code, in assignment order.
@DomainEventHandler(OrderDefined)
export class OrderDefinedAuditHandler implements DomainEventHandlerOf<OrderDefined> {
  constructor(private readonly projector: AuditLogProjector) {}

  async handle(event: OrderDefined): Promise<void> {
    await this.projector.project(
      AuditRecordType.Order,
      event.orderId,
      AuditAction.Registered,
      [
        {
          field: 'orderNumber',
          previousValue: '',
          newValue: event.snapshot.orderNumber,
        },
        ...event.snapshot.miCodes.map(({ miCode }) => ({
          field: 'miCode',
          previousValue: '',
          newValue: miCode,
        })),
      ],
    );
  }
}
