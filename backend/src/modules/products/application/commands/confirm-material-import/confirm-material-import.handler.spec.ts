import { Clock, Identity } from '@framework/domain';
import {
  MaterialImportEmpty,
  MaterialImportHasInvalidRows,
} from '@products/application/exceptions';
import { ImmediateUnitOfWork } from '@products/application/support/immediate-unit-of-work';
import { InMemoryMaterialImportRepository } from '@products/application/support/in-memory-material-import-repository';
import { InMemoryMaterialRepository } from '@products/application/support/in-memory-material-repository';
import { MaterialRegisteredByImport } from '@products/domain/events/material-registered-by-import.event';
import { MaterialRevisedByImport } from '@products/domain/events/material-revised-by-import.event';
import { MaterialsImported } from '@products/domain/events/materials-imported.event';
import { Material } from '@products/domain/material.aggregate';
import { MaterialImportRow } from '@products/domain/service/material-import-classifier';
import { MaterialCode } from '@products/domain/value/material-code.vo';
import { MaterialName } from '@products/domain/value/material-name.vo';

import { MATERIAL_IMPORT_LOCK } from '../material-import-lock';
import { ConfirmMaterialImportCommand } from './confirm-material-import.command';
import { ConfirmMaterialImportHandler } from './confirm-material-import.handler';

const NOW = new Date('2026-10-29T08:00:00.000Z');

class FixedClock extends Clock {
  now(): Date {
    return NOW;
  }
}

function makeSut() {
  const materialRepository = new InMemoryMaterialRepository();
  const materialImportRepository = new InMemoryMaterialImportRepository();
  const seed = (name: string, code: string) =>
    materialRepository.seed(
      Material.register(
        MaterialName.fromString(name),
        MaterialCode.fromString(code),
      ),
    );
  const copper = seed('مسی', 'M-101');
  const brass = seed('برنج', 'B-1');
  seed('قلع', 'T-1');
  const unitOfWork = new ImmediateUnitOfWork();
  const sut = new ConfirmMaterialImportHandler(
    materialRepository,
    materialImportRepository,
    unitOfWork,
    new FixedClock(),
  );
  return {
    sut,
    materialRepository,
    materialImportRepository,
    unitOfWork,
    copper,
    brass,
  };
}

function confirm(...rows: [number, string, string][]) {
  return new ConfirmMaterialImportCommand(
    rows.map(([row, name, code]): MaterialImportRow => ({ row, name, code })),
  );
}

async function materialsOf(repository: InMemoryMaterialRepository) {
  const materials = await repository.list();
  return materials.map((each) => [
    each.name().asString(),
    each.code().asString(),
  ]);
}

describe('ConfirmMaterialImportHandler', () => {
  it('registers, re-codes and renames materials as the kept rows say', async () => {
    const { sut, materialRepository } = makeSut();

    await sut.execute(
      confirm(
        [3, 'آلومینیوم', 'A-1'],
        [4, 'مسی', 'M-201'],
        [5, 'برنج زرد', 'B-1'],
      ),
    );

    expect(await materialsOf(materialRepository)).toEqual([
      ['مسی', 'M-201'],
      ['برنج زرد', 'B-1'],
      ['قلع', 'T-1'],
      ['آلومینیوم', 'A-1'],
    ]);
  });

  it('records the import, with one MaterialsImported event listing its changes in file order', async () => {
    const { sut, materialRepository, materialImportRepository, copper } =
      makeSut();

    const { id } = await sut.execute(
      confirm([3, 'آلومینیوم', 'A-1'], [4, 'مسی', 'M-201']),
    );

    const aluminium = await materialRepository.findByCode(
      MaterialCode.fromString('A-1'),
    );
    expect(materialImportRepository.dispatchedEvents()).toEqual([
      new MaterialsImported(id, [
        {
          kind: 'register',
          materialId: aluminium?.id.asString() ?? 'not registered',
          previousName: null,
          previousCode: null,
          name: 'آلومینیوم',
          code: 'A-1',
        },
        {
          kind: 'changeCode',
          materialId: copper.id.asString(),
          previousName: 'مسی',
          previousCode: 'M-101',
          name: 'مسی',
          code: 'M-201',
        },
      ]),
    ]);
    const recorded = await materialImportRepository.get(
      Identity.fromString(id),
    );
    expect(recorded.importedAt()).toEqual(NOW);
  });

  it('the materials it registers or edits dispatch only their import-specific events', async () => {
    const { sut, materialRepository } = makeSut();

    await sut.execute(confirm([3, 'آلومینیوم', 'A-1'], [4, 'برنج زرد', 'B-1']));

    expect(
      materialRepository.dispatchedEvents().map((event) => event.constructor),
    ).toEqual([MaterialRegisteredByImport, MaterialRevisedByImport]);
  });

  it('runs serialised with every other import and reversion', async () => {
    const { sut, unitOfWork } = makeSut();

    await sut.execute(confirm([3, 'آلومینیوم', 'A-1']));

    expect(unitOfWork.lockKeysTaken()).toEqual([MATERIAL_IMPORT_LOCK]);
  });

  it('ignores kept rows that change nothing', async () => {
    const { sut, materialImportRepository } = makeSut();

    const { id } = await sut.execute(
      confirm([3, 'مسی', 'M-101'], [4, 'آلومینیوم', 'A-1']),
    );

    const recorded = await materialImportRepository.get(
      Identity.fromString(id),
    );
    expect(recorded.changes().map((change) => change.name())).toEqual([
      'آلومینیوم',
    ]);
  });

  it('normalises digits of the kept rows before applying them', async () => {
    const { sut, materialRepository } = makeSut();

    await sut.execute(confirm([3, 'مس شماره ۲', 'C-۲']));

    expect(await materialsOf(materialRepository)).toContainEqual([
      'مس شماره 2',
      'C-2',
    ]);
  });

  it('refuses the whole import, writing nothing, when a kept row has an error', async () => {
    const { sut, materialRepository, materialImportRepository } = makeSut();

    await expect(
      sut.execute(confirm([3, 'آلومینیوم', 'A-1'], [4, 'مسی', 'B-1'])),
    ).rejects.toEqual(
      MaterialImportHasInvalidRows.withRows([
        { row: 4, name: 'مسی', code: 'B-1', errors: ['code-taken'] },
      ]),
    );
    expect(await materialsOf(materialRepository)).toEqual([
      ['مسی', 'M-101'],
      ['برنج', 'B-1'],
      ['قلع', 'T-1'],
    ]);
    expect(materialImportRepository.all()).toEqual([]);
  });

  it('refuses a kept row with a missing code', async () => {
    const { sut } = makeSut();

    await expect(sut.execute(confirm([3, 'آلومینیوم', '']))).rejects.toEqual(
      MaterialImportHasInvalidRows.withRows([
        { row: 3, name: 'آلومینیوم', code: '', errors: ['code-required'] },
      ]),
    );
  });

  it('judges the kept rows against the materials as they are now, not as previewed', async () => {
    const { sut, materialRepository } = makeSut();
    materialRepository.seed(
      Material.register(
        MaterialName.fromString('روی'),
        MaterialCode.fromString('A-1'),
      ),
    );

    await sut.execute(confirm([3, 'آلومینیوم', 'A-1']));

    expect(await materialsOf(materialRepository)).toEqual([
      ['مسی', 'M-101'],
      ['برنج', 'B-1'],
      ['قلع', 'T-1'],
      ['آلومینیوم', 'A-1'],
    ]);
  });

  it('refuses an import whose kept rows change nothing', async () => {
    const { sut, materialImportRepository } = makeSut();

    await expect(
      sut.execute(confirm([3, 'مسی', 'M-101'])),
    ).rejects.toBeInstanceOf(MaterialImportEmpty);
    expect(materialImportRepository.all()).toEqual([]);
  });

  it('refuses an import with no kept row', async () => {
    const { sut } = makeSut();

    await expect(sut.execute(confirm())).rejects.toBeInstanceOf(
      MaterialImportEmpty,
    );
  });
});
