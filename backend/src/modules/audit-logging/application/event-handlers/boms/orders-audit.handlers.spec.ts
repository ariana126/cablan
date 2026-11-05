import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { OrderDefined } from '@boms/domain/events/order-defined.event';
import { OrderDeleted } from '@boms/domain/events/order-deleted.event';
import { OrderEdited } from '@boms/domain/events/order-edited.event';
import { OrderMiCodeAdded } from '@boms/domain/events/order-mi-code-added.event';

import { OrderDefinedAuditHandler } from './order-defined.handler';
import { OrderDeletedAuditHandler } from './order-deleted.handler';
import { OrderEditedAuditHandler } from './order-edited.handler';
import { OrderMiCodeAddedAuditHandler } from './order-mi-code-added.handler';

function fakeProjector() {
  return { project: jest.fn().mockResolvedValue() };
}

const SNAPSHOT = {
  orderNumber: 'ORD-5001',
  miCodes: [
    { miCode: '1001', productName: 'کابل 2.5' },
    { miCode: '2001', productName: 'کابل 4' },
  ],
};

describe('order audit handlers (issue #101)', () => {
  it('projects OrderDefined as an Order Registered entry: its number, then one line per MI code', async () => {
    const projector = fakeProjector();
    const sut = new OrderDefinedAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(new OrderDefined('order-1', SNAPSHOT));

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.Order,
      'order-1',
      AuditAction.Registered,
      [
        { field: 'orderNumber', previousValue: '', newValue: 'ORD-5001' },
        { field: 'miCode', previousValue: '', newValue: '1001' },
        { field: 'miCode', previousValue: '', newValue: '2001' },
      ],
    );
  });

  it('projects OrderMiCodeAdded as an Order Edited entry adding the MI code', async () => {
    const projector = fakeProjector();
    const sut = new OrderMiCodeAddedAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(
      new OrderMiCodeAdded('order-1', 'ORD-5001', '1002', 'کابل 2.5'),
    );

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.Order,
      'order-1',
      AuditAction.Edited,
      [{ field: 'miCode', previousValue: '', newValue: '1002' }],
    );
  });

  it("projects OrderEdited as an Order Edited entry, passing the event's changes through", async () => {
    const projector = fakeProjector();
    const sut = new OrderEditedAuditHandler(
      projector as unknown as AuditLogProjector,
    );
    const changes = [
      {
        field: 'orderNumber' as const,
        previousValue: 'ORD-5001',
        newValue: 'ORD-5010',
      },
      {
        field: 'miCodes' as const,
        previousValue: '1001, 1002',
        newValue: '1001',
      },
    ];

    await sut.handle(new OrderEdited('order-1', 'ORD-5010', changes));

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.Order,
      'order-1',
      AuditAction.Edited,
      changes,
    );
  });

  it('projects OrderDeleted as an Order Deleted entry showing what it held', async () => {
    const projector = fakeProjector();
    const sut = new OrderDeletedAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(new OrderDeleted('order-1', SNAPSHOT));

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.Order,
      'order-1',
      AuditAction.Deleted,
      [
        { field: 'orderNumber', previousValue: 'ORD-5001', newValue: '' },
        { field: 'miCode', previousValue: '1001', newValue: '' },
        { field: 'miCode', previousValue: '2001', newValue: '' },
      ],
    );
  });
});
