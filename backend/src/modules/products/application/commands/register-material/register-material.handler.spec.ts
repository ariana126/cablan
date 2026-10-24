import {
  MaterialCodeAlreadyExists,
  MaterialNameAlreadyExists,
} from '@products/application/exceptions';
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

function registerCommand(name: string, code: string): RegisterMaterialCommand {
  return new RegisterMaterialCommand(
    MaterialName.fromString(name),
    MaterialCode.fromString(code),
  );
}

describe('RegisterMaterialHandler', () => {
  it('registers a new material with its code', async () => {
    const { sut, materialRepository } = makeSut();

    const result = await sut.execute(registerCommand('Steel Rod', 'RM-001'));

    const saved = await materialRepository.findByName(
      MaterialName.fromString('Steel Rod'),
    );
    expect(saved?.name().asString()).toBe('Steel Rod');
    expect(saved?.code().asString()).toBe('RM-001');
    expect(result).toEqual({ id: saved?.id.asString() });
  });

  it('rejects registering a material name that is already taken', async () => {
    const { sut, materialRepository } = makeSut();
    materialRepository.seed(
      Material.register(
        MaterialName.fromString('Steel Rod'),
        MaterialCode.fromString('RM-001'),
      ),
    );

    await expect(
      sut.execute(registerCommand('Steel Rod', 'RM-002')),
    ).rejects.toBeInstanceOf(MaterialNameAlreadyExists);
  });

  it('rejects registering a material code that is already taken', async () => {
    const { sut, materialRepository } = makeSut();
    materialRepository.seed(
      Material.register(
        MaterialName.fromString('Steel Rod'),
        MaterialCode.fromString('RM-001'),
      ),
    );

    await expect(
      sut.execute(registerCommand('Copper', 'RM-001')),
    ).rejects.toBeInstanceOf(MaterialCodeAlreadyExists);
    expect(
      await materialRepository.findByName(MaterialName.fromString('Copper')),
    ).toBeNull();
  });

  it('rejects a material code typed with Persian digits that is already taken in English digits', async () => {
    const { sut, materialRepository } = makeSut();
    materialRepository.seed(
      Material.register(
        MaterialName.fromString('Steel Rod'),
        MaterialCode.fromString('1234'),
      ),
    );

    await expect(
      sut.execute(registerCommand('Copper', '۱۲۳۴')),
    ).rejects.toBeInstanceOf(MaterialCodeAlreadyExists);
  });
});
