import { EntityRepository, Identity } from '@framework/domain';

import { Product } from '../product.aggregate';

export abstract class ProductRepository extends EntityRepository<Product> {
  abstract list(): Promise<Product[]>;

  /** Whether any product's composition carries one of these materials. */
  abstract anyUsesMaterial(materialIds: readonly Identity[]): Promise<boolean>;

  /**
   * Hard delete: nothing yet references a product, so the row is removed
   * outright rather than kept behind a flag — mirroring `ComponentRepository`
   * and `MaterialRepository`.
   */
  abstract delete(product: Product): Promise<void>;
}
