import { MaterialNameAlreadyExists } from '@materials/application/exceptions';
import { InMemoryMaterialRepository } from '@materials/application/support/in-memory-material-repository';
import { Material } from '@materials/domain/material.aggregate';
import { MaterialName } from '@materials/domain/value/material-name.vo';

import { RegisterMaterialCommand } from './register-material.command';
import { RegisterMaterialHandler } from './register-material.handler';

function makeSut() {
  const materialRepository = new InMemoryMaterialRepository();
  const sut = new RegisterMaterialHandler(materialRepository);
  return { sut, materialRepository };
}

describe('RegisterMaterialHandler', () => {
  it('registers a new material', async () => {
    const { sut, materialRepository } = makeSut();

    const result = await sut.execute(
      new RegisterMaterialCommand(MaterialName.fromString('Steel Rod')),
    );

    const saved = await materialRepository.findByName(
      MaterialName.fromString('Steel Rod'),
    );
    expect(saved?.name().asString()).toBe('Steel Rod');
    expect(result).toEqual({ id: saved?.id.asString() });
  });

  it('rejects registering a material name that is already taken', async () => {
    const { sut, materialRepository } = makeSut();
    materialRepository.seed(
      Material.register(MaterialName.fromString('Steel Rod')),
    );

    await expect(
      sut.execute(
        new RegisterMaterialCommand(MaterialName.fromString('Steel Rod')),
      ),
    ).rejects.toBeInstanceOf(MaterialNameAlreadyExists);
  });
});
