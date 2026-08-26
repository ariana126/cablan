import {
  ModelDelegate,
  PrismaEntityRepository,
  PrismaService,
} from '@framework/infrastructure';
import { Injectable } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { Prisma, PrismaClient } from '@prisma/client';
import { Product } from '@products/domain/product.aggregate';
import { ProductRepository } from '@products/domain/service/product.repository';

import {
  ProductComponentRecord,
  ProductMapper,
  ProductRecord,
} from './product.mapper';

// The full row shape `product.findUnique`/`upsert`/`delete` return once
// `components`/`materials` are included — used only inside this file to
// reshape a Prisma result into the flat `ProductRecord` the domain mapper
// expects.
type ProductWithComposition = Prisma.ProductGetPayload<{
  include: { components: { include: { materials: true } } };
}>;

const COMPOSITION_INCLUDE = {
  components: { include: { materials: true } },
} as const;

function toRecord(record: ProductWithComposition): ProductRecord {
  return {
    id: record.id,
    name: record.name,
    components: record.components.map((component) => ({
      componentId: component.componentId,
      name: component.name,
      materials: component.materials.map((material) => ({
        materialId: material.materialId,
        name: material.name,
      })),
    })),
  };
}

function toNestedCreate(components: ProductComponentRecord[]) {
  return components.map((component) => ({
    componentId: component.componentId,
    name: component.name,
    materials: {
      create: component.materials.map((material) => ({
        materialId: material.materialId,
        name: material.name,
      })),
    },
  }));
}

/**
 * `ModelDelegate<ProductRecord>` implemented by hand rather than passed as
 * `prisma.product` directly, unlike `PrismaComponentRepository`/
 * `PrismaMaterialRepository`: a product's aggregate spans three tables
 * (`product`, `product_component`, `product_material`), so this adapter is
 * what loads/saves the nested shape `ProductMapper` expects. See
 * `src/modules/products/CLAUDE.md`.
 */
class ProductDelegate implements ModelDelegate<ProductRecord> {
  constructor(private readonly prisma: PrismaClient) {}

  async findUnique(args: {
    where: { id: string };
  }): Promise<ProductRecord | null> {
    const record = await this.prisma.product.findUnique({
      where: args.where,
      include: COMPOSITION_INCLUDE,
    });
    return record ? toRecord(record) : null;
  }

  async upsert(args: {
    where: { id: string };
    create: ProductRecord;
    update: Omit<ProductRecord, 'id'>;
  }): Promise<ProductRecord> {
    const { where, create, update } = args;
    const saved = await this.prisma.$transaction(async (tx) => {
      // `Product.updateComponents()` discards the previous composition in
      // full rather than merging with it — this mirrors that literally,
      // deleting the product's existing `product_component` rows (cascading
      // to `product_material`) before recreating the composition the
      // aggregate now holds. A no-op the first time a product is saved,
      // since nothing yet references its (not-yet-existing) id.
      await tx.productComponent.deleteMany({
        where: { productId: where.id },
      });
      return tx.product.upsert({
        where,
        create: {
          id: create.id,
          name: create.name,
          components: { create: toNestedCreate(create.components) },
        },
        update: {
          name: update.name,
          components: { create: toNestedCreate(update.components) },
        },
        include: COMPOSITION_INCLUDE,
      });
    });
    return toRecord(saved);
  }

  async delete(args: { where: { id: string } }): Promise<ProductRecord> {
    // `onDelete: Cascade` on `product_component`/`product_material` removes
    // the rest of the composition; the master `Component`/`Material` rows
    // those lines point at are untouched — they are standalone aggregates
    // owned by their own modules (see `Product.delete()`'s doc comment).
    const record = await this.prisma.product.delete({
      where: args.where,
      include: COMPOSITION_INCLUDE,
    });
    return toRecord(record);
  }
}

@Injectable()
export class PrismaProductRepository
  extends PrismaEntityRepository<Product, ProductRecord>
  implements ProductRepository
{
  constructor(
    private readonly prisma: PrismaService,
    eventBus: EventBus,
  ) {
    super(new ProductDelegate(prisma), eventBus);
  }

  protected toDomain(record: ProductRecord): Product {
    return ProductMapper.toDomain(record);
  }

  protected toPersistence(entity: Product): ProductRecord {
    return ProductMapper.toPersistence(entity);
  }

  async list(): Promise<Product[]> {
    const records = await this.prisma.product.findMany({
      include: COMPOSITION_INCLUDE,
    });
    return records.map((record) => this.toDomain(toRecord(record)));
  }
}
