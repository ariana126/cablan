import { InMemoryMaterialRepository } from '@materials/application/support/in-memory-material-repository';
import { Material } from '@materials/domain/material.aggregate';
import { MaterialName } from '@materials/domain/value/material-name.vo';

import { ListMaterialsHandler } from './list-materials.handler';

describe('ListMaterialsHandler', () => {
  it('lists every registered material as a read model', async () => {
    const materialRepository = new InMemoryMaterialRepository();
    const sut = new ListMaterialsHandler(materialRepository);
    materialRepository.seed(
      Material.register(MaterialName.fromString('Steel Rod')),
    );

    const result = await sut.execute();

    expect(result).toEqual([expect.objectContaining({ name: 'Steel Rod' })]);
  });

  it('lists no materials when none are registered', async () => {
    const materialRepository = new InMemoryMaterialRepository();
    const sut = new ListMaterialsHandler(materialRepository);

    const result = await sut.execute();

    expect(result).toEqual([]);
  });
});
