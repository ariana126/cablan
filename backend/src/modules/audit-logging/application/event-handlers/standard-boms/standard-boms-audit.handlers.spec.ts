import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { StandardBomComponentsUpdated } from '@standard-boms/domain/events/standard-bom-components-updated.event';
import { StandardBomDeleted } from '@standard-boms/domain/events/standard-bom-deleted.event';
import { StandardBomEdited } from '@standard-boms/domain/events/standard-bom-edited.event';
import { StandardBomRegistered } from '@standard-boms/domain/events/standard-bom-registered.event';

import { StandardBomComponentsUpdatedAuditHandler } from './standard-bom-components-updated.handler';
import { StandardBomDeletedAuditHandler } from './standard-bom-deleted.handler';
import { StandardBomEditedAuditHandler } from './standard-bom-edited.handler';
import { StandardBomRegisteredAuditHandler } from './standard-bom-registered.handler';

function fakeProjector() {
  return { project: jest.fn().mockResolvedValue() };
}

describe('standard-boms audit handlers', () => {
  it('projects a StandardBomRegistered event as a StandardBom Registered entry', async () => {
    const projector = fakeProjector();
    const sut = new StandardBomRegisteredAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(
      new StandardBomRegistered('standard-bom-1', '1001', 'product-1', []),
    );

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.StandardBom,
      'standard-bom-1',
      AuditAction.Registered,
    );
  });

  it("projects a StandardBomEdited event as a StandardBom Edited entry, passing the event's own changes through unchanged", async () => {
    const projector = fakeProjector();
    const sut = new StandardBomEditedAuditHandler(
      projector as unknown as AuditLogProjector,
    );
    const changes = [
      { field: 'standardLength', previousValue: '305', newValue: '310' },
      { field: 'brand', previousValue: 'Legrand', newValue: 'Nexans' },
    ];

    await sut.handle(
      new StandardBomEdited(
        'standard-bom-1',
        '1001',
        'Nexans',
        310,
        undefined,
        true,
        changes,
      ),
    );

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.StandardBom,
      'standard-bom-1',
      AuditAction.Edited,
      changes,
    );
  });

  it('projects a StandardBomDeleted event as a StandardBom Deleted entry', async () => {
    const projector = fakeProjector();
    const sut = new StandardBomDeletedAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(new StandardBomDeleted('standard-bom-1', '1001'));

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.StandardBom,
      'standard-bom-1',
      AuditAction.Deleted,
    );
  });

  it('projects a StandardBomComponentsUpdated event as a StandardBom Edited entry with no changes', async () => {
    const projector = fakeProjector();
    const sut = new StandardBomComponentsUpdatedAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(
      new StandardBomComponentsUpdated('standard-bom-1', ['component-1']),
    );

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.StandardBom,
      'standard-bom-1',
      AuditAction.Edited,
    );
  });
});
