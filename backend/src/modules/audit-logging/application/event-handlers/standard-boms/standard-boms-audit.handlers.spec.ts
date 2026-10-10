import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { StandardBomSnapshot } from '@standard-boms/domain/events/standard-bom.snapshot';
import { StandardBomDeleted } from '@standard-boms/domain/events/standard-bom-deleted.event';
import { StandardBomEdited } from '@standard-boms/domain/events/standard-bom-edited.event';
import { StandardBomRegistered } from '@standard-boms/domain/events/standard-bom-registered.event';

import { StandardBomDeletedAuditHandler } from './standard-bom-deleted.handler';
import { StandardBomEditedAuditHandler } from './standard-bom-edited.handler';
import { StandardBomRegisteredAuditHandler } from './standard-bom-registered.handler';

function fakeProjector() {
  return { project: jest.fn().mockResolvedValue() };
}

function standardBomSnapshot(
  overrides: Partial<StandardBomSnapshot> = {},
): StandardBomSnapshot {
  return {
    miCode: '1001',
    brand: 'Legrand',
    standardLength: 305,
    active: true,
    description: 'Network cable',
    productId: 'product-1',
    productName: 'Cat6',
    components: [
      {
        name: 'Core',
        materials: [
          { name: 'Copper', weightInGrams: 12 },
          { name: 'PVC', weightInGrams: 3 },
        ],
      },
    ],
    ...overrides,
  };
}

describe('standard-boms audit handlers', () => {
  it('projects a StandardBomRegistered event as a StandardBom Registered entry showing every registered field and one line per component', async () => {
    const projector = fakeProjector();
    const sut = new StandardBomRegisteredAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(
      new StandardBomRegistered('standard-bom-1', standardBomSnapshot()),
    );

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.StandardBom,
      'standard-bom-1',
      AuditAction.Registered,
      [
        { field: 'miCode', previousValue: '', newValue: '1001' },
        { field: 'productName', previousValue: '', newValue: 'Cat6' },
        { field: 'brand', previousValue: '', newValue: 'Legrand' },
        { field: 'standardLength', previousValue: '', newValue: '305' },
        { field: 'active', previousValue: '', newValue: 'true' },
        { field: 'description', previousValue: '', newValue: 'Network cable' },
        {
          field: 'component',
          previousValue: '',
          newValue: 'Core: Copper (12 گرم)، PVC (3 گرم)',
        },
      ],
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

  it('projects a StandardBomEdited event that replaced the composition with its field changes followed by the components that differ', async () => {
    const projector = fakeProjector();
    const sut = new StandardBomEditedAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(
      new StandardBomEdited(
        'standard-bom-1',
        '1001',
        'Nexans',
        305,
        undefined,
        true,
        [{ field: 'brand', previousValue: 'Legrand', newValue: 'Nexans' }],
        {
          previous: [
            {
              name: 'Core',
              materials: [{ name: 'Copper', weightInGrams: 12 }],
            },
          ],
          current: [
            {
              name: 'Core',
              materials: [{ name: 'Copper', weightInGrams: 14 }],
            },
          ],
        },
      ),
    );

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.StandardBom,
      'standard-bom-1',
      AuditAction.Edited,
      [
        { field: 'brand', previousValue: 'Legrand', newValue: 'Nexans' },
        {
          field: 'component',
          previousValue: 'Core: Copper (12 گرم)',
          newValue: 'Core: Copper (14 گرم)',
        },
      ],
    );
  });

  it('projects a StandardBomDeleted event as a StandardBom Deleted entry showing every field as it stood, leaving out an empty description', async () => {
    const projector = fakeProjector();
    const sut = new StandardBomDeletedAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(
      new StandardBomDeleted(
        'standard-bom-1',
        standardBomSnapshot({ active: false, description: undefined }),
      ),
    );

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.StandardBom,
      'standard-bom-1',
      AuditAction.Deleted,
      [
        { field: 'miCode', previousValue: '1001', newValue: '' },
        { field: 'productName', previousValue: 'Cat6', newValue: '' },
        { field: 'brand', previousValue: 'Legrand', newValue: '' },
        { field: 'standardLength', previousValue: '305', newValue: '' },
        { field: 'active', previousValue: 'false', newValue: '' },
        {
          field: 'component',
          previousValue: 'Core: Copper (12 گرم)، PVC (3 گرم)',
          newValue: '',
        },
      ],
    );
  });
});
