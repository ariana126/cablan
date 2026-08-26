import { EntityRepository } from '@framework/domain';

import { Product } from '../product.aggregate';

export abstract class ProductRepository extends EntityRepository<Product> {
  abstract list(): Promise<Product[]>;

  /**
   * Hard delete: nothing yet references a product, so the row is removed
   * outright rather than kept behind a flag — mirroring `ComponentRepository`
   * and `MaterialRepository`.
   */
  abstract delete(product: Product): Promise<void>;
}
