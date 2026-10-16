import { MaterialNameAlreadyExists } from '@products/application/exceptions';
import { InMemoryMaterialRepository } from '@products/application/support/in-memory-material-repository';
import { Material } from '@products/domain/material.aggregate';
import { MaterialCode } from '@products/domain/value/material-code.vo';
import { MaterialName } from '@products/domain/value/material-name.vo';

import { RegisterMaterialCommand } from './register-material.command';
import { RegisterMaterialHandler } from './register-material.handler';

function makeSut() {
  const materialRepository = new InMemoryMaterialRepository();
  const sut = new RegisterMaterialHandler(materialRepository);
  return { sut, materialRepository };
}

describe('RegisterMaterialHandler', () => {
  it('registers a new material with its code', async () => {
    const { sut, materialRepository } = makeSut();

    const result = await sut.execute(
      new RegisterMaterialCommand(
        MaterialName.fromString('Steel Rod'),
        MaterialCode.fromString('RM-001'),
      ),
    );

    const saved = await materialRepository.findByName(
      MaterialName.fromString('Steel Rod'),
    );
    expect(saved?.name().asString()).toBe('Steel Rod');
    expect(saved?.code()?.asString()).toBe('RM-001');
    expect(result).toEqual({ id: saved?.id.asString() });
  });

  it('registers a new material without a code', async () => {
    const { sut, materialRepository } = makeSut();

    await sut.execute(
      new RegisterMaterialCommand(MaterialName.fromString('Steel Rod'), null),
    );

    const saved = await materialRepository.findByName(
      MaterialName.fromString('Steel Rod'),
    );
    expect(saved?.code()).toBeNull();
  });

  it('rejects registering a material name that is already taken', async () => {
    const { sut, materialRepository } = makeSut();
    materialRepository.seed(
      Material.register(MaterialName.fromString('Steel Rod'), null),
    );

    await expect(
      sut.execute(
        new RegisterMaterialCommand(MaterialName.fromString('Steel Rod'), null),
      ),
    ).rejects.toBeInstanceOf(MaterialNameAlreadyExists);
  });
});
