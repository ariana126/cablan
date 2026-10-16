import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { ManufacturingInstructionSnapshot } from '@manufacturing-instructions/domain/events/manufacturing-instruction.snapshot';
import { ManufacturingInstructionDeleted } from '@manufacturing-instructions/domain/events/manufacturing-instruction-deleted.event';
import { ManufacturingInstructionEdited } from '@manufacturing-instructions/domain/events/manufacturing-instruction-edited.event';
import { ManufacturingInstructionRegistered } from '@manufacturing-instructions/domain/events/manufacturing-instruction-registered.event';

import { ManufacturingInstructionDeletedAuditHandler } from './manufacturing-instruction-deleted.handler';
import { ManufacturingInstructionEditedAuditHandler } from './manufacturing-instruction-edited.handler';
import { ManufacturingInstructionRegisteredAuditHandler } from './manufacturing-instruction-registered.handler';

function fakeProjector() {
  return { project: jest.fn().mockResolvedValue() };
}

function manufacturingInstructionSnapshot(
  overrides: Partial<ManufacturingInstructionSnapshot> = {},
): ManufacturingInstructionSnapshot {
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

describe('manufacturing-instructions audit handlers', () => {
  it('projects a ManufacturingInstructionRegistered event as a ManufacturingInstruction Registered entry showing every registered field and one line per component', async () => {
    const projector = fakeProjector();
    const sut = new ManufacturingInstructionRegisteredAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(
      new ManufacturingInstructionRegistered(
        'standard-bom-1',
        manufacturingInstructionSnapshot(),
      ),
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

  it("projects a ManufacturingInstructionEdited event as a ManufacturingInstruction Edited entry, passing the event's own changes through unchanged", async () => {
    const projector = fakeProjector();
    const sut = new ManufacturingInstructionEditedAuditHandler(
      projector as unknown as AuditLogProjector,
    );
    const changes = [
      { field: 'standardLength', previousValue: '305', newValue: '310' },
      { field: 'brand', previousValue: 'Legrand', newValue: 'Nexans' },
    ];

    await sut.handle(
      new ManufacturingInstructionEdited(
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

  it('projects a ManufacturingInstructionEdited event that replaced the composition with its field changes followed by the components that differ', async () => {
    const projector = fakeProjector();
    const sut = new ManufacturingInstructionEditedAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(
      new ManufacturingInstructionEdited(
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

  it('projects a ManufacturingInstructionDeleted event as a ManufacturingInstruction Deleted entry showing every field as it stood, leaving out an empty description', async () => {
    const projector = fakeProjector();
    const sut = new ManufacturingInstructionDeletedAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(
      new ManufacturingInstructionDeleted(
        'standard-bom-1',
        manufacturingInstructionSnapshot({
          active: false,
          description: undefined,
        }),
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
