import { Clock, Identity } from '@framework/domain';
import { MaterialImportNotFound } from '@products/application/exceptions';
import { ImmediateUnitOfWork } from '@products/application/support/immediate-unit-of-work';
import { InMemoryMaterialImportRepository } from '@products/application/support/in-memory-material-import-repository';
import { InMemoryMaterialRepository } from '@products/application/support/in-memory-material-repository';
import { InMemoryProductRepository } from '@products/application/support/in-memory-product-repository';
import { MaterialImportReverted } from '@products/domain/events/material-import-reverted.event';
import { MaterialImportNotLatest } from '@products/domain/exceptions/material-import-not-latest.exception';
import { Material } from '@products/domain/material.aggregate';
import { MaterialImport } from '@products/domain/material-import.aggregate';
import { MaterialImportReversion } from '@products/domain/service/material-import-reversion';
import { MaterialCode } from '@products/domain/value/material-code.vo';
import { MaterialImportChange } from '@products/domain/value/material-import-change.vo';
import { MaterialName } from '@products/domain/value/material-name.vo';

import { MATERIAL_IMPORT_LOCK } from '../material-import-lock';
import { RevertMaterialImportCommand } from './revert-material-import.command';
import { RevertMaterialImportHandler } from './revert-material-import.handler';

const IMPORTED_AT = new Date('2026-10-29T08:00:00.000Z');
const NOW = new Date('2026-10-29T09:00:00.000Z');

class FixedClock extends Clock {
  now(): Date {
    return NOW;
  }
}

// What a reversion checks and undoes is `MaterialImportReversion`'s spec; this
// one pins what the handler adds around it.
function makeSut() {
  const materialRepository = new InMemoryMaterialRepository();
  const materialImportRepository = new InMemoryMaterialImportRepository();
  const unitOfWork = new ImmediateUnitOfWork();
  const sut = new RevertMaterialImportHandler(
    materialImportRepository,
    new MaterialImportReversion(
      materialImportRepository,
      materialRepository,
      new InMemoryProductRepository(),
    ),
    unitOfWork,
    new FixedClock(),
  );
  return { sut, materialRepository, materialImportRepository, unitOfWork };
}

/** An import that registered «آلومینیوم» (A-1), as it stands afterwards. */
function afterAnImport(context: ReturnType<typeof makeSut>): MaterialImport {
  const aluminium = context.materialRepository.seed(
    Material.register(
      MaterialName.fromString('آلومینیوم'),
      MaterialCode.fromString('A-1'),
    ),
  );
  return context.materialImportRepository.seed(
    MaterialImport.fromPersistence(
      Identity.new(),
      [MaterialImportChange.registration(aluminium.id, 'آلومینیوم', 'A-1')],
      IMPORTED_AT,
      null,
    ),
  );
}

describe('RevertMaterialImportHandler', () => {
  it('undoes the import and saves it reverted, dispatching its MaterialImportReverted', async () => {
    const context = makeSut();
    const materialImport = afterAnImport(context);

    await context.sut.execute(
      new RevertMaterialImportCommand(materialImport.id),
    );

    expect(await context.materialRepository.list()).toEqual([]);
    const saved = await context.materialImportRepository.get(materialImport.id);
    expect(saved.revertedAt()).toEqual(NOW);
    expect(context.materialImportRepository.dispatchedEvents()).toEqual([
      new MaterialImportReverted(
        materialImport.id.asString(),
        materialImport.changes().map((change) => change.snapshot()),
      ),
    ]);
  });

  it('refuses an import that does not exist', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(new RevertMaterialImportCommand(Identity.new())),
    ).rejects.toBeInstanceOf(MaterialImportNotFound);
  });

  it("passes the reversion's refusal on, saving nothing", async () => {
    const context = makeSut();
    const materialImport = afterAnImport(context);
    context.materialImportRepository.seed(
      MaterialImport.fromPersistence(
        Identity.new(),
        [MaterialImportChange.registration(Identity.new(), 'روی', 'Z-1')],
        NOW,
        null,
      ),
    );

    await expect(
      context.sut.execute(new RevertMaterialImportCommand(materialImport.id)),
    ).rejects.toBeInstanceOf(MaterialImportNotLatest);
    expect(context.materialImportRepository.dispatchedEvents()).toEqual([]);
  });

  it('runs serialised with every other import and reversion', async () => {
    const context = makeSut();
    const materialImport = afterAnImport(context);

    await context.sut.execute(
      new RevertMaterialImportCommand(materialImport.id),
    );

    expect(context.unitOfWork.lockKeysTaken()).toEqual([MATERIAL_IMPORT_LOCK]);
  });
});
