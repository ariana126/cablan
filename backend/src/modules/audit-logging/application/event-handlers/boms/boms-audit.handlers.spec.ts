import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { BomComponentsUpdated } from '@boms/domain/events/bom-components-updated.event';
import { BomDeleted } from '@boms/domain/events/bom-deleted.event';
import { BomEdited } from '@boms/domain/events/bom-edited.event';
import { BomRegistered } from '@boms/domain/events/bom-registered.event';

import { BomComponentsUpdatedAuditHandler } from './bom-components-updated.handler';
import { BomDeletedAuditHandler } from './bom-deleted.handler';
import { BomEditedAuditHandler } from './bom-edited.handler';
import { BomRegisteredAuditHandler } from './bom-registered.handler';

function fakeProjector() {
  return { project: jest.fn().mockResolvedValue() };
}

describe('boms audit handlers', () => {
  it('projects a BomRegistered event as a Bom Registered entry', async () => {
    const projector = fakeProjector();
    const sut = new BomRegisteredAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(
      new BomRegistered('bom-1', 'standard-bom-1', 'ORD-2001', 'TRK-3001', []),
    );

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.Bom,
      'bom-1',
      AuditAction.Registered,
    );
  });

  it("projects a BomEdited event as a Bom Edited entry, passing the event's own changes through unchanged", async () => {
    const projector = fakeProjector();
    const sut = new BomEditedAuditHandler(
      projector as unknown as AuditLogProjector,
    );
    const changes = [
      {
        field: 'trackingNumber',
        previousValue: 'TRK-3001',
        newValue: 'TRK-3005',
      },
    ];

    await sut.handle(
      new BomEdited('bom-1', 'ORD-2001', 'TRK-3005', undefined, changes),
    );

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.Bom,
      'bom-1',
      AuditAction.Edited,
      changes,
    );
  });

  it('projects a BomDeleted event as a Bom Deleted entry', async () => {
    const projector = fakeProjector();
    const sut = new BomDeletedAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(new BomDeleted('bom-1', 'ORD-2001'));

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.Bom,
      'bom-1',
      AuditAction.Deleted,
    );
  });

  it('projects a BomComponentsUpdated event as a Bom Edited entry with no changes', async () => {
    const projector = fakeProjector();
    const sut = new BomComponentsUpdatedAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(new BomComponentsUpdated('bom-1', ['component-1']));

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.Bom,
      'bom-1',
      AuditAction.Edited,
    );
  });
});
