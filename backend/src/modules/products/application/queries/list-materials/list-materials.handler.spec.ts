import { InMemoryMaterialRepository } from '@products/application/support/in-memory-material-repository';
import { Material } from '@products/domain/material.aggregate';
import { MaterialCode } from '@products/domain/value/material-code.vo';
import { MaterialName } from '@products/domain/value/material-name.vo';

import { ListMaterialsHandler } from './list-materials.handler';
import { MaterialReadModel } from './material.read-model';

describe('ListMaterialsHandler', () => {
  it('lists every registered material with its code', async () => {
    const materialRepository = new InMemoryMaterialRepository();
    const sut = new ListMaterialsHandler(materialRepository);
    const steel = materialRepository.seed(
      Material.register(
        MaterialName.fromString('Steel Rod'),
        MaterialCode.fromString('RM-001'),
      ),
    );
    const copper = materialRepository.seed(
      Material.register(
        MaterialName.fromString('Copper'),
        MaterialCode.fromString('RM-002'),
      ),
    );

    const result = await sut.execute();

    expect(result).toEqual([
      new MaterialReadModel(steel.id.asString(), 'Steel Rod', 'RM-001'),
      new MaterialReadModel(copper.id.asString(), 'Copper', 'RM-002'),
    ]);
  });

  it('lists no materials when none are registered', async () => {
    const materialRepository = new InMemoryMaterialRepository();
    const sut = new ListMaterialsHandler(materialRepository);

    const result = await sut.execute();

    expect(result).toEqual([]);
  });
});
