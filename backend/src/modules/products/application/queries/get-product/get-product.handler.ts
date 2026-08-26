import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ProductReadModel } from '@products/application/queries/list-products/product.read-model';
import { ProductRepository } from '@products/domain/service/product.repository';

import { GetProductQuery } from './get-product.query';

// Read-side counterpart to `ProductCompositionFactory`'s write-side crossing
// (see src/modules/products/CLAUDE.md): the one query another module
// (`standard-boms`) is allowed to dispatch through the `QueryBus` to read a
// product's current composition, rather than reaching into this module's
// repository directly.
@QueryHandler(GetProductQuery)
export class GetProductHandler implements IQueryHandler<GetProductQuery> {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(query: GetProductQuery): Promise<ProductReadModel> {
    const product = await this.productRepository.get(query.productId);
    return ProductReadModel.fromDomain(product);
  }
}
