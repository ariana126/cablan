import {
  DependentRecord,
  DependentsProbe,
  RecordReference,
} from '@framework/application';
import { PrismaService } from '@framework/infrastructure';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';

/**
 * `products`' answer to "which of my records reference this one?" (issue
 * #94): a product references every material and component in its
 * composition (`product_component`, `product_material`). Found by
 * `RecordDependenciesModule` because it extends `DependentsProbe`. On
 * `txHost.tx`, like every read on the write path.
 */
@Injectable()
export class PrismaProductsDependentsProbe extends DependentsProbe {
  constructor(
    private readonly txHost: TransactionHost<
      TransactionalAdapterPrisma<PrismaService>
    >,
  ) {
    super();
  }

  async dependentsOf(
    reference: RecordReference,
  ): Promise<readonly DependentRecord[]> {
    switch (reference.type) {
      case 'Material': {
        return this.productsWhere({
          materials: { some: { materialId: reference.id } },
        });
      }
      case 'Component': {
        return this.productsWhere({ componentId: reference.id });
      }
      default: {
        return [];
      }
    }
  }

  private async productsWhere(component: {
    componentId?: string;
    materials?: { some: { materialId: string } };
  }): Promise<DependentRecord[]> {
    const products = await this.txHost.tx.product.findMany({
      where: { components: { some: component } },
      select: { name: true },
    });
    return products.map(({ name }) => ({ kind: 'product', name }));
  }
}
