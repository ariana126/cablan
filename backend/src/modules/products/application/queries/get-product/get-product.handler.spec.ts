import { EntityNotFound, Identity } from '@framework/domain';
import { InMemoryProductRepository } from '@products/application/support/in-memory-product-repository';
import { Product } from '@products/domain/product.aggregate';
import { ProductComponentLine } from '@products/domain/value/product-component-line.vo';
import { ProductMaterialLine } from '@products/domain/value/product-material-line.vo';
import { ProductName } from '@products/domain/value/product-name.vo';

import { GetProductHandler } from './get-product.handler';
import { GetProductQuery } from './get-product.query';

describe('GetProductHandler', () => {
  it('gets a registered product as a read model', async () => {
    const productRepository = new InMemoryProductRepository();
    const sut = new GetProductHandler(productRepository);
    const product = productRepository.seed(
      Product.register(ProductName.fromString('Widget'), [
        ProductComponentLine.of(Identity.new(), 'Bolt', [
          ProductMaterialLine.of(Identity.new(), 'Steel Rod'),
        ]),
      ]),
    );

    const result = await sut.execute(new GetProductQuery(product.id));

    expect(result).toEqual(
      expect.objectContaining({
        id: product.id.asString(),
        name: 'Widget',
        components: [
          expect.objectContaining({
            name: 'Bolt',
            materials: [expect.objectContaining({ name: 'Steel Rod' })],
          }),
        ],
      }),
    );
  });

  it('rejects getting a product that does not exist', async () => {
    const productRepository = new InMemoryProductRepository();
    const sut = new GetProductHandler(productRepository);

    await expect(
      sut.execute(new GetProductQuery(Identity.new())),
    ).rejects.toBeInstanceOf(EntityNotFound);
  });
});
