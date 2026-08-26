import { EntityNotFound, Identity } from '@framework/domain';
import { InMemoryProductRepository } from '@products/application/support/in-memory-product-repository';
import { Product } from '@products/domain/product.aggregate';
import { ProductComponentLine } from '@products/domain/value/product-component-line.vo';
import { ProductMaterialLine } from '@products/domain/value/product-material-line.vo';
import { ProductName } from '@products/domain/value/product-name.vo';

import { DeleteProductCommand } from './delete-product.command';
import { DeleteProductHandler } from './delete-product.handler';

describe('DeleteProductHandler', () => {
  it('hard-deletes a product', async () => {
    const productRepository = new InMemoryProductRepository();
    const sut = new DeleteProductHandler(productRepository);
    const product = productRepository.seed(
      Product.register(ProductName.fromString('Widget'), [
        ProductComponentLine.of(Identity.new(), 'Bolt', [
          ProductMaterialLine.of(Identity.new(), 'Steel Rod'),
        ]),
      ]),
    );

    await sut.execute(new DeleteProductCommand(product.id));

    await expect(productRepository.get(product.id)).rejects.toBeInstanceOf(
      EntityNotFound,
    );
  });

  it('rejects deleting a product that does not exist', async () => {
    const productRepository = new InMemoryProductRepository();
    const sut = new DeleteProductHandler(productRepository);

    await expect(
      sut.execute(new DeleteProductCommand(Identity.new())),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
