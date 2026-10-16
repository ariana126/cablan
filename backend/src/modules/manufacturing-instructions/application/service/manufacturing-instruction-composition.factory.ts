import { EntityNotFound, Identity } from '@framework/domain';
import {
  RegisterManufacturingInstructionComponentInput,
  RegisterManufacturingInstructionMaterialInput,
} from '@manufacturing-instructions/application/commands/manufacturing-instruction-component.input';
import {
  ManufacturingInstructionCompositionEntryNotFound,
  ManufacturingInstructionProductNotFound,
} from '@manufacturing-instructions/application/exceptions';
import { ManufacturingInstructionComponentLine } from '@manufacturing-instructions/domain/value/manufacturing-instruction-component-line.vo';
import { ManufacturingInstructionMaterialLine } from '@manufacturing-instructions/domain/value/manufacturing-instruction-material-line.vo';
import { Weight } from '@manufacturing-instructions/domain/value/weight.vo';
import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { GetProductQuery } from '@products/application/queries/get-product/get-product.query';
import { ProductReadModel } from '@products/application/queries/list-products/product.read-model';

type ProductComponent = ProductReadModel['components'][number];
type ProductMaterial = ProductComponent['materials'][number];

/**
 * The product's name, alongside the standard BOM's own owned component lines
 * cloned from that product's current composition. `productName` is what
 * `RegisterManufacturingInstructionHandler` fixes onto the new `ManufacturingInstruction` — cloned
 * once, at registration, the same way `productId` itself is — since the
 * referenced product cannot be changed through an edit (see
 * `ManufacturingInstruction.edit()`'s doc comment). `EditManufacturingInstructionHandler` reuses only
 * `componentLines` from this, ignoring `productName`.
 */
export interface ManufacturingInstructionComposition {
  readonly productName: string;
  readonly componentLines: ManufacturingInstructionComponentLine[];
}

/**
 * Clones a product's *current* composition into a standard BOM's own owned
 * component/material lines, attaching the caller-supplied weight to each
 * material. This is a real copy, not a reference: once built, the returned
 * `ManufacturingInstructionComponentLine`s are immutable value objects with no link back
 * to the product, so a later change to the product's own composition (a new
 * component, a renamed material) never retroactively changes an
 * already-registered standard BOM.
 *
 * Reads the product through `GetProductQuery` on the `QueryBus` — never a
 * direct call into `products`' repository or domain layer — the read-side
 * mirror of `ProductCompositionFactory`'s write-side crossing into
 * `components`/`materials`. See src/modules/manufacturing-instructions/CLAUDE.md and the
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
export class ManufacturingInstructionCompositionFactory {
  constructor(private readonly queryBus: QueryBus) {}

  async buildComponentLines(
    productId: Identity,
    components: RegisterManufacturingInstructionComponentInput[],
  ): Promise<ManufacturingInstructionComposition> {
    const product = await this.fetchProduct(productId);
    return {
      productName: product.name,
      componentLines: components.map((component) =>
        ManufacturingInstructionCompositionFactory.buildComponentLine(
          product,
          component,
        ),
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
        throw ManufacturingInstructionProductNotFound.withId(
          productId.asString(),
        );
      }
      throw error;
    }
  }

  private static buildComponentLine(
    product: ProductReadModel,
    component: RegisterManufacturingInstructionComponentInput,
  ): ManufacturingInstructionComponentLine {
    const existingComponent = product.components.find(
      (candidate) => candidate.id === component.componentId,
    );
    if (existingComponent === undefined) {
      throw ManufacturingInstructionCompositionEntryNotFound.forComponent(
        component.componentId,
      );
    }

    const materialLines = component.materials.map((material) =>
      ManufacturingInstructionCompositionFactory.buildMaterialLine(
        existingComponent,
        material,
      ),
    );

    return ManufacturingInstructionComponentLine.of(
      Identity.fromString(existingComponent.id),
      existingComponent.name,
      materialLines,
    );
  }

  private static buildMaterialLine(
    component: ProductComponent,
    material: RegisterManufacturingInstructionMaterialInput,
  ): ManufacturingInstructionMaterialLine {
    const existingMaterial: ProductMaterial | undefined =
      component.materials.find(
        (candidate) => candidate.id === material.materialId,
      );
    if (existingMaterial === undefined) {
      throw ManufacturingInstructionCompositionEntryNotFound.forMaterial(
        material.materialId,
      );
    }

    return ManufacturingInstructionMaterialLine.of(
      Identity.fromString(existingMaterial.id),
      existingMaterial.name,
      Weight.ofGrams(material.weight),
    );
  }
}
