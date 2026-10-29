import { DomainEventDispatcher } from '@framework/application';
import { Identity } from '@framework/domain';
import {
  ModelDelegate,
  PrismaEntityRepository,
  PrismaService,
} from '@framework/infrastructure';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Prisma } from '@prisma/client';
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
 * `ModelDelegate<ProductRecord>` implemented by hand rather than returned
 * as `tx.product` directly, unlike `PrismaComponentRepository`/
 * `PrismaMaterialRepository`: a product's aggregate spans three tables
 * (`product`, `product_component`, `product_material`), so this adapter is
 * what loads/saves the nested shape `ProductMapper` expects. See
 * `src/modules/products/CLAUDE.md`.
 *
 * Built per call from `txHost.tx`, so it never opens a transaction of its
 * own: `upsert` runs inside the one `PrismaEntityRepository.save()` opened,
 * and its delete-and-recreate commits or rolls back with the product's
 * events' subscribers (ADR 0007).
 */
class ProductDelegate implements ModelDelegate<ProductRecord> {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async findUnique(args: {
    where: { id: string };
  }): Promise<ProductRecord | null> {
    const record = await this.db.product.findUnique({
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
    // `Product.updateComponents()` discards the previous composition in
    // full rather than merging with it — this mirrors that literally,
    // deleting the product's existing `product_component` rows (cascading
    // to `product_material`) before recreating the composition the
    // aggregate now holds. A no-op the first time a product is saved,
    // since nothing yet references its (not-yet-existing) id.
    await this.db.productComponent.deleteMany({
      where: { productId: where.id },
    });
    const saved = await this.db.product.upsert({
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
    return toRecord(saved);
  }

  async delete(args: { where: { id: string } }): Promise<ProductRecord> {
    // `onDelete: Cascade` on `product_component`/`product_material` removes
    // the rest of the composition; the master `Component`/`Material` rows
    // those lines point at are untouched — they are standalone aggregates
    // with their own lifecycle (see `Product.delete()`'s doc comment).
    const record = await this.db.product.delete({
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
    txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    dispatcher: DomainEventDispatcher,
  ) {
    super(txHost, dispatcher);
  }

  protected delegate(): ModelDelegate<ProductRecord> {
    return new ProductDelegate(this.txHost.tx);
  }

  protected toDomain(record: ProductRecord): Product {
    return ProductMapper.toDomain(record);
  }

  protected toPersistence(entity: Product): ProductRecord {
    return ProductMapper.toPersistence(entity);
  }

  async list(): Promise<Product[]> {
    const records = await this.txHost.tx.product.findMany({
      include: COMPOSITION_INCLUDE,
    });
    return records.map((record) => this.toDomain(toRecord(record)));
  }

  async anyUsesMaterial(materialIds: readonly Identity[]): Promise<boolean> {
    const uses = await this.txHost.tx.productMaterial.count({
      where: { materialId: { in: materialIds.map((id) => id.asString()) } },
    });
    return uses > 0;
  }
}
