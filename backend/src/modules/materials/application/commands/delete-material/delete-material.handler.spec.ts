import { EntityNotFound, Identity } from '@framework/domain';
import { InMemoryMaterialRepository } from '@materials/application/support/in-memory-material-repository';
import { Material } from '@materials/domain/material.aggregate';
import { MaterialName } from '@materials/domain/value/material-name.vo';

import { DeleteMaterialCommand } from './delete-material.command';
import { DeleteMaterialHandler } from './delete-material.handler';

describe('DeleteMaterialHandler', () => {
  it('hard-deletes a material, and its name becomes free again', async () => {
    const materialRepository = new InMemoryMaterialRepository();
    const sut = new DeleteMaterialHandler(materialRepository);
    const material = materialRepository.seed(
      Material.register(MaterialName.fromString('Steel Rod')),
    );

    await sut.execute(new DeleteMaterialCommand(material.id));

    await expect(materialRepository.get(material.id)).rejects.toBeInstanceOf(
      EntityNotFound,
    );
    expect(
      await materialRepository.findByName(MaterialName.fromString('Steel Rod')),
    ).toBeNull();
  });

  it('rejects deleting a material that does not exist', async () => {
    const materialRepository = new InMemoryMaterialRepository();
    const sut = new DeleteMaterialHandler(materialRepository);

    await expect(
      sut.execute(new DeleteMaterialCommand(Identity.new())),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
