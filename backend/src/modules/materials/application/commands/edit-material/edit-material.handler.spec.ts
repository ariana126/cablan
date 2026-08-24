import { EntityNotFound, Identity } from '@framework/domain';
import { MaterialNameAlreadyExists } from '@materials/application/exceptions';
import { InMemoryMaterialRepository } from '@materials/application/support/in-memory-material-repository';
import { Material } from '@materials/domain/material.aggregate';
import { MaterialName } from '@materials/domain/value/material-name.vo';

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
): Material {
  return materialRepository.seed(
    Material.register(MaterialName.fromString(name)),
  );
}

describe('EditMaterialHandler', () => {
  it('renames a material', async () => {
    const { sut, materialRepository } = makeSut();
    const material = seedMaterial(materialRepository, 'Steel Rod');

    await sut.execute(
      new EditMaterialCommand(
        material.id,
        MaterialName.fromString('Aluminium Rod'),
      ),
    );

    const saved = await materialRepository.get(material.id);
    expect(saved.name().asString()).toBe('Aluminium Rod');
  });

  it('rejects renaming a material to a name already taken by another material', async () => {
    const { sut, materialRepository } = makeSut();
    seedMaterial(materialRepository, 'Steel Rod');
    const other = seedMaterial(materialRepository, 'Aluminium Rod');

    await expect(
      sut.execute(
        new EditMaterialCommand(other.id, MaterialName.fromString('Steel Rod')),
      ),
    ).rejects.toBeInstanceOf(MaterialNameAlreadyExists);
  });

  it('allows renaming a material to its own current name', async () => {
    const { sut, materialRepository } = makeSut();
    const material = seedMaterial(materialRepository, 'Steel Rod');

    await sut.execute(
      new EditMaterialCommand(
        material.id,
        MaterialName.fromString('Steel Rod'),
      ),
    );

    const saved = await materialRepository.get(material.id);
    expect(saved.name().asString()).toBe('Steel Rod');
  });

  it('rejects editing a material that does not exist', async () => {
    const { sut } = makeSut();

    await expect(
      sut.execute(
        new EditMaterialCommand(
          Identity.new(),
          MaterialName.fromString('Steel Rod'),
        ),
      ),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
