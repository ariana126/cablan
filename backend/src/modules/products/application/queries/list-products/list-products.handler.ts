import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ProductRepository } from '@products/domain/service/product.repository';

import { ListProductsQuery } from './list-products.query';
import { ProductReadModel } from './product.read-model';

@QueryHandler(ListProductsQuery)
export class ListProductsHandler implements IQueryHandler<ListProductsQuery> {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(): Promise<ProductReadModel[]> {
    const products = await this.productRepository.list();
    return products.map((product) => ProductReadModel.fromDomain(product));
  }
}
