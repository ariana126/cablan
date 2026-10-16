import { EntityNotFound, Identity } from '@framework/domain';
import { MaterialNameAlreadyExists } from '@products/application/exceptions';
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
  code: string | null = null,
): Material {
  return materialRepository.seed(
    Material.register(
      MaterialName.fromString(name),
      MaterialCode.fromOptionalString(code),
    ),
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
        undefined,
      ),
    );

    const saved = await materialRepository.get(material.id);
    expect(saved.name().asString()).toBe('Aluminium Rod');
  });

  it("changes a material's code", async () => {
    const { sut, materialRepository } = makeSut();
    const material = seedMaterial(materialRepository, 'Steel Rod', 'RM-001');

    await sut.execute(
      new EditMaterialCommand(
        material.id,
        MaterialName.fromString('Steel Rod'),
        MaterialCode.fromString('RM-002'),
      ),
    );

    const saved = await materialRepository.get(material.id);
    expect(saved.code()?.asString()).toBe('RM-002');
  });

  it("clears a material's code", async () => {
    const { sut, materialRepository } = makeSut();
    const material = seedMaterial(materialRepository, 'Steel Rod', 'RM-001');

    await sut.execute(
      new EditMaterialCommand(
        material.id,
        MaterialName.fromString('Steel Rod'),
        null,
      ),
    );

    const saved = await materialRepository.get(material.id);
    expect(saved.code()).toBeNull();
  });

  it("keeps a material's code when the edit leaves it out", async () => {
    const { sut, materialRepository } = makeSut();
    const material = seedMaterial(materialRepository, 'Steel Rod', 'RM-001');

    await sut.execute(
      new EditMaterialCommand(
        material.id,
        MaterialName.fromString('Aluminium Rod'),
        undefined,
      ),
    );

    const saved = await materialRepository.get(material.id);
    expect(saved.code()?.asString()).toBe('RM-001');
  });

  it('rejects renaming a material to a name already taken by another material', async () => {
    const { sut, materialRepository } = makeSut();
    seedMaterial(materialRepository, 'Steel Rod');
    const other = seedMaterial(materialRepository, 'Aluminium Rod');

    await expect(
      sut.execute(
        new EditMaterialCommand(
          other.id,
          MaterialName.fromString('Steel Rod'),
          undefined,
        ),
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
        undefined,
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
          undefined,
        ),
      ),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
