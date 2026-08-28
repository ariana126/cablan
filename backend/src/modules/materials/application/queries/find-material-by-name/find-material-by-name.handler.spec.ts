import { InMemoryMaterialRepository } from '@materials/application/support/in-memory-material-repository';
import { Material } from '@materials/domain/material.aggregate';
import { MaterialName } from '@materials/domain/value/material-name.vo';

import { FindMaterialByNameHandler } from './find-material-by-name.handler';
import { FindMaterialByNameQuery } from './find-material-by-name.query';

describe('FindMaterialByNameHandler', () => {
  it('finds the id and name of a material already registered under that name', async () => {
    const materialRepository = new InMemoryMaterialRepository();
    const sut = new FindMaterialByNameHandler(materialRepository);
    const material = materialRepository.seed(
      Material.register(MaterialName.fromString('Steel Rod')),
    );

    const result = await sut.execute(
      new FindMaterialByNameQuery(MaterialName.fromString('Steel Rod')),
    );

    expect(result).toEqual({
      id: material.id.asString(),
      name: 'Steel Rod',
    });
  });

  it('finds nothing when no material is registered under that name', async () => {
    const materialRepository = new InMemoryMaterialRepository();
    const sut = new FindMaterialByNameHandler(materialRepository);

    const result = await sut.execute(
      new FindMaterialByNameQuery(MaterialName.fromString('Steel Rod')),
    );

    expect(result).toBeUndefined();
  });
});
