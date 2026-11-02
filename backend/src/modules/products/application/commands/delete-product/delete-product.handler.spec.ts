import {
  RecordDependencies,
  RecordHasDependents,
} from '@framework/application';
import { StubDependentsProbe } from '@framework/application/support/stub-dependents-probe';
import { EntityNotFound, Identity } from '@framework/domain';
import { InMemoryProductRepository } from '@products/application/support/in-memory-product-repository';
import { Product } from '@products/domain/product.aggregate';
import { ProductComponentLine } from '@products/domain/value/product-component-line.vo';
import { ProductMaterialLine } from '@products/domain/value/product-material-line.vo';
import { ProductName } from '@products/domain/value/product-name.vo';

import { DeleteProductCommand } from './delete-product.command';
import { DeleteProductHandler } from './delete-product.handler';

function seedWidget(productRepository: InMemoryProductRepository): Product {
  return productRepository.seed(
    Product.register(ProductName.fromString('Widget'), [
      ProductComponentLine.of(Identity.new(), 'Bolt', [
        ProductMaterialLine.of(Identity.new(), 'Steel Rod'),
      ]),
    ]),
  );
}

describe('DeleteProductHandler', () => {
  it('hard-deletes a product', async () => {
    const productRepository = new InMemoryProductRepository();
    const sut = new DeleteProductHandler(
      productRepository,
      new RecordDependencies([]),
    );
    const product = seedWidget(productRepository);

    await sut.execute(new DeleteProductCommand(product.id));

    await expect(productRepository.get(product.id)).rejects.toBeInstanceOf(
      EntityNotFound,
    );
  });

  it('refuses deleting a product a standard BOM references, keeping it', async () => {
    const productRepository = new InMemoryProductRepository();
    const product = seedWidget(productRepository);
    const probe = new StubDependentsProbe().given(
      { type: 'Product', id: product.id.asString() },
      [{ kind: 'standard-bom', name: 'MI-100' }],
    );
    const sut = new DeleteProductHandler(
      productRepository,
      new RecordDependencies([probe]),
    );

    await expect(
      sut.execute(new DeleteProductCommand(product.id)),
    ).rejects.toBeInstanceOf(RecordHasDependents);
    expect(await productRepository.find(product.id)).not.toBeNull();
  });

  it('rejects deleting a product that does not exist', async () => {
    const productRepository = new InMemoryProductRepository();
    const sut = new DeleteProductHandler(
      productRepository,
      new RecordDependencies([]),
    );

    await expect(
      sut.execute(new DeleteProductCommand(Identity.new())),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
