import { EntityNotFound, Identity } from '@framework/domain';
import { Product } from '@products/domain/product.aggregate';
import { ProductRepository } from '@products/domain/service/product.repository';

// A hand-written fake, not a mock: `ProductRepository` is an in-process
// collaborator from a handler's point of view, so tests use a real (if
// simplified) implementation rather than asserting on calls made to it.
export class InMemoryProductRepository extends ProductRepository {
  private readonly productsById = new Map<string, Product>();

  find(id: Identity): Promise<Product | null> {
    return Promise.resolve(this.productsById.get(id.asString()) ?? null);
  }

  async get(id: Identity): Promise<Product> {
    const product = await this.find(id);
    if (!product) {
      throw EntityNotFound.withId(id);
    }
    return product;
  }

  save(entity: Product): Promise<void> {
    this.productsById.set(entity.id.asString(), entity);
    entity.releaseEvents();
    return Promise.resolve();
  }

  delete(product: Product): Promise<void> {
    this.productsById.delete(product.id.asString());
    product.releaseEvents();
    return Promise.resolve();
  }

  list(): Promise<Product[]> {
    return Promise.resolve([...this.productsById.values()]);
  }

  seed(product: Product): Product {
    this.productsById.set(product.id.asString(), product);
    product.releaseEvents();
    return product;
  }
}
