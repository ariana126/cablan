import {
  DependentRecord,
  RecordDependencies,
  RecordHasDependents,
} from '@framework/application';
import { StubDependentsProbe } from '@framework/application/support/stub-dependents-probe';
import { EntityNotFound, Identity } from '@framework/domain';
import { InMemoryMaterialRepository } from '@products/application/support/in-memory-material-repository';
import { Material } from '@products/domain/material.aggregate';
import { MaterialCode } from '@products/domain/value/material-code.vo';
import { MaterialName } from '@products/domain/value/material-name.vo';

import { DeleteMaterialCommand } from './delete-material.command';
import { DeleteMaterialHandler } from './delete-material.handler';

function makeSut(dependents: readonly DependentRecord[] = []) {
  const materialRepository = new InMemoryMaterialRepository();
  const material = materialRepository.seed(
    Material.register(
      MaterialName.fromString('Steel Rod'),
      MaterialCode.fromString('RM-001'),
    ),
  );
  const probe = new StubDependentsProbe().given(
    { type: 'Material', id: material.id.asString() },
    dependents,
  );
  const sut = new DeleteMaterialHandler(
    materialRepository,
    new RecordDependencies([probe]),
  );
  return { sut, materialRepository, material };
}

describe('DeleteMaterialHandler', () => {
  it('hard-deletes a material, and its name becomes free again', async () => {
    const { sut, materialRepository, material } = makeSut();

    await sut.execute(new DeleteMaterialCommand(material.id));

    await expect(materialRepository.get(material.id)).rejects.toBeInstanceOf(
      EntityNotFound,
    );
    expect(
      await materialRepository.findByName(MaterialName.fromString('Steel Rod')),
    ).toBeNull();
  });

  it('refuses deleting a material another record references, keeping it', async () => {
    const { sut, materialRepository, material } = makeSut([
      { kind: 'product', name: 'کابل NYY' },
    ]);

    await expect(
      sut.execute(new DeleteMaterialCommand(material.id)),
    ).rejects.toBeInstanceOf(RecordHasDependents);
    expect(await materialRepository.find(material.id)).not.toBeNull();
  });

  it('rejects deleting a material that does not exist', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(new DeleteMaterialCommand(Identity.new())),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
