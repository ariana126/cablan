import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
import { AuditLogProjector } from '@audit-logging/application/service/audit-log-projector.service';
import { MaterialImportChangeSnapshot } from '@products/domain/events/material-import-change.snapshot';
import { MaterialImportReverted } from '@products/domain/events/material-import-reverted.event';
import { MaterialsImported } from '@products/domain/events/materials-imported.event';

import { MaterialImportRevertedAuditHandler } from './material-import-reverted.handler';
import { MaterialsImportedAuditHandler } from './materials-imported.handler';

function fakeProjector() {
  return { project: jest.fn().mockResolvedValue() };
}

const CHANGES: MaterialImportChangeSnapshot[] = [
  {
    kind: 'register',
    materialId: 'material-1',
    previousName: null,
    previousCode: null,
    name: 'آلومینیوم',
    code: 'A-1',
  },
  {
    kind: 'changeCode',
    materialId: 'material-2',
    previousName: 'مسی',
    previousCode: 'M-101',
    name: 'مسی',
    code: 'M-201',
  },
  {
    kind: 'rename',
    materialId: 'material-3',
    previousName: 'برنج',
    previousCode: 'B-1',
    name: 'برنج زرد',
    code: 'B-1',
  },
];

describe('material import audit handlers', () => {
  it('projects a MaterialsImported event as one MaterialImport Imported entry, a line per change in file order', async () => {
    const projector = fakeProjector();
    const sut = new MaterialsImportedAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(new MaterialsImported('import-1', CHANGES));

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.MaterialImport,
      'import-1',
      AuditAction.Imported,
      [
        {
          field: 'importedMaterial:A-1',
          previousValue: '',
          newValue: 'آلومینیوم',
        },
        {
          field: 'materialCode:مسی',
          previousValue: 'M-101',
          newValue: 'M-201',
        },
        {
          field: 'materialName:B-1',
          previousValue: 'برنج',
          newValue: 'برنج زرد',
        },
      ],
    );
  });

  it('projects a MaterialImportReverted event as one MaterialImport Reverted entry, the same lines with their values swapped', async () => {
    const projector = fakeProjector();
    const sut = new MaterialImportRevertedAuditHandler(
      projector as unknown as AuditLogProjector,
    );

    await sut.handle(new MaterialImportReverted('import-1', CHANGES));

    expect(projector.project).toHaveBeenCalledWith(
      AuditRecordType.MaterialImport,
      'import-1',
      AuditAction.Reverted,
      [
        {
          field: 'importedMaterial:A-1',
          previousValue: 'آلومینیوم',
          newValue: '',
        },
        {
          field: 'materialCode:مسی',
          previousValue: 'M-201',
          newValue: 'M-101',
        },
        {
          field: 'materialName:B-1',
          previousValue: 'برنج زرد',
          newValue: 'برنج',
        },
      ],
    );
  });
});
