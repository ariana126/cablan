import { Identity } from '@framework/domain';
import { InMemoryProductRepository } from '@products/application/support/in-memory-product-repository';
import { Product } from '@products/domain/product.aggregate';
import { ProductComponentLine } from '@products/domain/value/product-component-line.vo';
import { ProductMaterialLine } from '@products/domain/value/product-material-line.vo';
import { ProductName } from '@products/domain/value/product-name.vo';

import { ListProductsHandler } from './list-products.handler';

describe('ListProductsHandler', () => {
  it('lists every registered product as a read model', async () => {
    const productRepository = new InMemoryProductRepository();
    const sut = new ListProductsHandler(productRepository);
    productRepository.seed(
      Product.register(ProductName.fromString('Widget'), [
        ProductComponentLine.of(Identity.new(), 'Bolt', [
          ProductMaterialLine.of(Identity.new(), 'Steel Rod'),
        ]),
      ]),
    );

    const result = await sut.execute();

    expect(result).toEqual([
      expect.objectContaining({
        name: 'Widget',
        components: [
          expect.objectContaining({
            name: 'Bolt',
            materials: [expect.objectContaining({ name: 'Steel Rod' })],
          }),
        ],
      }),
    ]);
  });

  it('lists no products when none are registered', async () => {
    const productRepository = new InMemoryProductRepository();
    const sut = new ListProductsHandler(productRepository);

    const result = await sut.execute();

    expect(result).toEqual([]);
  });
});
