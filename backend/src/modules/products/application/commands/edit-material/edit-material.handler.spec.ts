import { EntityNotFound, Identity } from '@framework/domain';
import {
  MaterialCodeAlreadyExists,
  MaterialNameAlreadyExists,
} from '@products/application/exceptions';
import { InMemoryMaterialRepository } from '@products/application/support/in-memory-material-repository';
import { Material } from '@products/domain/material.aggregate';
import { MaterialCode } from '@products/domain/value/material-code.vo';
import { MaterialName } from '@products/domain/value/material-name.vo';

import { EditMaterialCommand } from './edit-material.command';
import { EditMaterialHandler } from './edit-material.handler';

function makeSut() {
  const materialRepository = new InMemoryMaterialRepository();
  const sut = new EditMaterialHandler(materialRepository);
  return { sut, materialRepository };
}

function seedMaterial(
  materialRepository: InMemoryMaterialRepository,
  name: string,
  code: string,
): Material {
  return materialRepository.seed(
    Material.register(
      MaterialName.fromString(name),
      MaterialCode.fromString(code),
    ),
  );
}

function editCommand(
  materialId: Identity,
  name: string,
  code: string,
): EditMaterialCommand {
  return new EditMaterialCommand(
    materialId,
    MaterialName.fromString(name),
    MaterialCode.fromString(code),
  );
}

describe('EditMaterialHandler', () => {
  it('renames a material', async () => {
    const { sut, materialRepository } = makeSut();
    const material = seedMaterial(materialRepository, 'Steel Rod', 'RM-001');

    await sut.execute(editCommand(material.id, 'Aluminium Rod', 'RM-001'));

    const saved = await materialRepository.get(material.id);
    expect(saved.name().asString()).toBe('Aluminium Rod');
  });

  it("changes a material's code", async () => {
    const { sut, materialRepository } = makeSut();
    const material = seedMaterial(materialRepository, 'Steel Rod', 'RM-001');

    await sut.execute(editCommand(material.id, 'Steel Rod', 'RM-002'));

    const saved = await materialRepository.get(material.id);
    expect(saved.code().asString()).toBe('RM-002');
  });

  it('rejects renaming a material to a name already taken by another material', async () => {
    const { sut, materialRepository } = makeSut();
    seedMaterial(materialRepository, 'Steel Rod', 'RM-001');
    const other = seedMaterial(materialRepository, 'Aluminium Rod', 'RM-002');

    await expect(
      sut.execute(editCommand(other.id, 'Steel Rod', 'RM-002')),
    ).rejects.toBeInstanceOf(MaterialNameAlreadyExists);
  });

  it('allows renaming a material to its own current name', async () => {
    const { sut, materialRepository } = makeSut();
    const material = seedMaterial(materialRepository, 'Steel Rod', 'RM-001');

    await sut.execute(editCommand(material.id, 'Steel Rod', 'RM-001'));

    const saved = await materialRepository.get(material.id);
    expect(saved.name().asString()).toBe('Steel Rod');
  });

  it('rejects changing a material code to one already taken by another material', async () => {
    const { sut, materialRepository } = makeSut();
    seedMaterial(materialRepository, 'Steel Rod', 'RM-001');
    const other = seedMaterial(materialRepository, 'Aluminium Rod', 'RM-002');

    await expect(
      sut.execute(editCommand(other.id, 'Aluminium Rod', 'RM-001')),
    ).rejects.toBeInstanceOf(MaterialCodeAlreadyExists);
    const unchanged = await materialRepository.get(other.id);
    expect(unchanged.code().asString()).toBe('RM-002');
  });

  it('allows an edit that keeps the material its own code', async () => {
    const { sut, materialRepository } = makeSut();
    const material = seedMaterial(materialRepository, 'Steel Rod', 'RM-001');

    await sut.execute(editCommand(material.id, 'Aluminium Rod', 'RM-001'));

    const saved = await materialRepository.get(material.id);
    expect(saved.code().asString()).toBe('RM-001');
  });

  it('rejects editing a material that does not exist', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(editCommand(Identity.new(), 'Steel Rod', 'RM-001')),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
