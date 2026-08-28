import { EntityNotFound, Identity } from '@framework/domain';
import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { GetProductQuery } from '@products/application/queries/get-product/get-product.query';
import { ProductReadModel } from '@products/application/queries/list-products/product.read-model';
import {
  RegisterStandardBomComponentInput,
  RegisterStandardBomMaterialInput,
} from '@standard-boms/application/commands/standard-bom-component.input';
import {
  StandardBomCompositionEntryNotFound,
  StandardBomProductNotFound,
} from '@standard-boms/application/exceptions';
import { StandardBomComponentLine } from '@standard-boms/domain/value/standard-bom-component-line.vo';
import { StandardBomMaterialLine } from '@standard-boms/domain/value/standard-bom-material-line.vo';
import { Weight } from '@standard-boms/domain/value/weight.vo';

type ProductComponent = ProductReadModel['components'][number];
type ProductMaterial = ProductComponent['materials'][number];

/**
 * The product's name, alongside the standard BOM's own owned component lines
 * cloned from that product's current composition. `productName` is what
 * `RegisterStandardBomHandler` fixes onto the new `StandardBom` — cloned
 * once, at registration, the same way `productId` itself is — since the
 * referenced product cannot be changed through an edit (see
 * `StandardBom.edit()`'s doc comment). `EditStandardBomHandler` reuses only
 * `componentLines` from this, ignoring `productName`.
 */
export interface StandardBomComposition {
  readonly productName: string;
  readonly componentLines: StandardBomComponentLine[];
}

/**
 * Clones a product's *current* composition into a standard BOM's own owned
 * component/material lines, attaching the caller-supplied weight to each
 * material. This is a real copy, not a reference: once built, the returned
 * `StandardBomComponentLine`s are immutable value objects with no link back
 * to the product, so a later change to the product's own composition (a new
 * component, a renamed material) never retroactively changes an
 * already-registered standard BOM.
 *
 * Reads the product through `GetProductQuery` on the `QueryBus` — never a
 * direct call into `products`' repository or domain layer — the read-side
 * mirror of `ProductCompositionFactory`'s write-side crossing into
 * `components`/`materials`. See src/modules/standard-boms/CLAUDE.md and the
 * narrow dependency-cruiser exception this relies on.
 *
 * Used identically by both registration and editing: neither operation
 * creates a new `Component`/`Material` master row, so there is no
 * "create vs. reuse" branch the way `ProductCompositionFactory` needs one —
 * every `componentId`/`materialId` here must already exist in the product's
 * current composition, or the whole request is rejected before anything is
 * built.
 */
@Injectable()
export class StandardBomCompositionFactory {
  constructor(private readonly queryBus: QueryBus) {}

  async buildComponentLines(
    productId: Identity,
    components: RegisterStandardBomComponentInput[],
  ): Promise<StandardBomComposition> {
    const product = await this.fetchProduct(productId);
    return {
      productName: product.name,
      componentLines: components.map((component) =>
        StandardBomCompositionFactory.buildComponentLine(product, component),
      ),
    };
  }

  private async fetchProduct(productId: Identity): Promise<ProductReadModel> {
    try {
      return await this.queryBus.execute<GetProductQuery, ProductReadModel>(
        new GetProductQuery(productId),
      );
    } catch (error) {
      if (error instanceof EntityNotFound) {
        throw StandardBomProductNotFound.withId(productId.asString());
      }
      throw error;
    }
  }

  private static buildComponentLine(
    product: ProductReadModel,
    component: RegisterStandardBomComponentInput,
  ): StandardBomComponentLine {
    const existingComponent = product.components.find(
      (candidate) => candidate.id === component.componentId,
    );
    if (existingComponent === undefined) {
      throw StandardBomCompositionEntryNotFound.forComponent(
        component.componentId,
      );
    }

    const materialLines = component.materials.map((material) =>
      StandardBomCompositionFactory.buildMaterialLine(
        existingComponent,
        material,
      ),
    );

    return StandardBomComponentLine.of(
      Identity.fromString(existingComponent.id),
      existingComponent.name,
      materialLines,
    );
  }

  private static buildMaterialLine(
    component: ProductComponent,
    material: RegisterStandardBomMaterialInput,
  ): StandardBomMaterialLine {
    const existingMaterial: ProductMaterial | undefined =
      component.materials.find(
        (candidate) => candidate.id === material.materialId,
      );
    if (existingMaterial === undefined) {
      throw StandardBomCompositionEntryNotFound.forMaterial(
        material.materialId,
      );
    }

    return StandardBomMaterialLine.of(
      Identity.fromString(existingMaterial.id),
      existingMaterial.name,
      Weight.ofGrams(material.weight),
    );
  }
}
