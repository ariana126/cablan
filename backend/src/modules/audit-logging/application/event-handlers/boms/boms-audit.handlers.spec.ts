import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { BomSnapshot } from '@boms/domain/events/bom.snapshot';
import { BomDeleted } from '@boms/domain/events/bom-deleted.event';
import { BomEdited } from '@boms/domain/events/bom-edited.event';
import { BomRegistered } from '@boms/domain/events/bom-registered.event';

import { BomDeletedAuditHandler } from './bom-deleted.handler';
import { BomEditedAuditHandler } from './bom-edited.handler';
import { BomRegisteredAuditHandler } from './bom-registered.handler';

function fakeProjector() {
  return { project: jest.fn().mockResolvedValue() };
}

function bomSnapshot(overrides: Partial<BomSnapshot> = {}): BomSnapshot {
  return {
    standardBomId: 'standard-bom-1',
    standardBomMiCode: '1001',
    brand: 'Legrand',
    productName: 'Cat6',
    standardLength: 305,
    orderNumber: 'ORD-2001',
    trackingNumber: 'TRK-3001',
    description: 'Morning shift',
    registeredBy: 'Sina',
    components: [
      { name: 'Core', materials: [{ name: 'Copper', weightInGrams: 12 }] },
    ],
    ...overrides,
  };
}

describe('boms audit handlers', () => {
  it('projects a BomRegistered event as a Bom Registered entry showing every registered field and one line per component', async () => {
    const projector = fakeProjector();
    const sut = new BomRegisteredAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(new BomRegistered('bom-1', bomSnapshot()));

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.Bom,
      'bom-1',
      AuditAction.Registered,
      [
        { field: 'orderNumber', previousValue: '', newValue: 'ORD-2001' },
        { field: 'trackingNumber', previousValue: '', newValue: 'TRK-3001' },
        { field: 'miCode', previousValue: '', newValue: '1001' },
        { field: 'productName', previousValue: '', newValue: 'Cat6' },
        { field: 'brand', previousValue: '', newValue: 'Legrand' },
        { field: 'standardLength', previousValue: '', newValue: '305' },
        { field: 'description', previousValue: '', newValue: 'Morning shift' },
        { field: 'registeredBy', previousValue: '', newValue: 'Sina' },
        {
          field: 'component',
          previousValue: '',
          newValue: 'Core: Copper (12 گرم)',
        },
      ],
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

  it('projects a BomEdited event that only replaced the composition with the components that differ, never an empty entry', async () => {
    const projector = fakeProjector();
    const sut = new BomEditedAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(
      new BomEdited('bom-1', 'ORD-2001', 'TRK-3001', undefined, [], {
        previous: [
          { name: 'Core', materials: [{ name: 'Copper', weightInGrams: 12 }] },
        ],
        current: [
          { name: 'Core', materials: [{ name: 'Copper', weightInGrams: 12 }] },
          { name: 'Jacket', materials: [{ name: 'PE', weightInGrams: 7 }] },
        ],
      }),
    );

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.Bom,
      'bom-1',
      AuditAction.Edited,
      [
        {
          field: 'component',
          previousValue: '',
          newValue: 'Jacket: PE (7 گرم)',
        },
      ],
    );
  });

  it('projects a BomDeleted event as a Bom Deleted entry showing every field as it stood, leaving out an empty description', async () => {
    const projector = fakeProjector();
    const sut = new BomDeletedAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(
      new BomDeleted('bom-1', bomSnapshot({ description: undefined })),
    );

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.Bom,
      'bom-1',
      AuditAction.Deleted,
      [
        { field: 'orderNumber', previousValue: 'ORD-2001', newValue: '' },
        { field: 'trackingNumber', previousValue: 'TRK-3001', newValue: '' },
        { field: 'miCode', previousValue: '1001', newValue: '' },
        { field: 'productName', previousValue: 'Cat6', newValue: '' },
        { field: 'brand', previousValue: 'Legrand', newValue: '' },
        { field: 'standardLength', previousValue: '305', newValue: '' },
        { field: 'registeredBy', previousValue: 'Sina', newValue: '' },
        {
          field: 'component',
          previousValue: 'Core: Copper (12 گرم)',
          newValue: '',
        },
      ],
    );
  });
});
