import {
  BomComponentInput,
  BomMaterialInput,
} from '@boms/application/commands/bom-component.input';
import {
  BomCompositionEntryNotFound,
  BomStandardBomNotFound,
} from '@boms/application/exceptions';
import { BomComponentLine } from '@boms/domain/value/bom-component-line.vo';
import { BomMaterialLine } from '@boms/domain/value/bom-material-line.vo';
import { Weight } from '@boms/domain/value/weight.vo';
import { EntityNotFound, Identity } from '@framework/domain';
import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { GetStandardBomByMiCodeQuery } from '@standard-boms/application/queries/get-standard-bom-by-mi-code/get-standard-bom-by-mi-code.query';
import { StandardBomReadModel } from '@standard-boms/application/queries/list-standard-boms/standard-bom.read-model';

type StandardBomComponent = StandardBomReadModel['components'][number];
type StandardBomMaterial = StandardBomComponent['materials'][number];

/**
 * A standard BOM's resolved id, alongside the daily BOM's own owned
 * component/material lines cloned from that standard BOM's current
 * composition. `standardBomId` is what `RegisterBomHandler` fixes onto the
 * new `Bom`; `EditBomHandler` reuses only `componentLines` from it, since a
 * daily BOM's `standardBomId` is not editable (see `Bom.edit()`'s doc
 * comment).
 */
export interface BomComposition {
  readonly standardBomId: Identity;
  readonly componentLines: BomComponentLine[];
}

/**
 * Clones a standard BOM's *current* composition into a daily BOM's own owned
 * component/material lines, attaching the caller-supplied weight to each
 * material. This is a real copy, not a reference: once built, the returned
 * `BomComponentLine`s are immutable value objects with no link back to the
 * standard BOM, so a later change to the standard BOM's own composition
 * never retroactively changes an already-registered daily BOM.
 *
 * Reads the standard BOM through `GetStandardBomByMiCodeQuery` on the
 * `QueryBus` — never a direct call into `standard-boms`' repository or
 * domain layer — the read-side mirror of `StandardBomCompositionFactory`'s
 * own read-side crossing into `products`. See src/modules/boms/CLAUDE.md and
 * the narrow dependency-cruiser exception this relies on.
 *
 * Used identically by both registration and editing: neither operation
 * creates a new `Component`/`Material` master row, so there is no
 * "create vs. reuse" branch — every `componentId`/`materialId` here must
 * already exist in the standard BOM's current composition, or the whole
 * request is rejected before anything is built.
 */
@Injectable()
export class BomCompositionFactory {
  constructor(private readonly queryBus: QueryBus) {}

  async buildComposition(
    standardBomMiCode: string,
    components: BomComponentInput[],
  ): Promise<BomComposition> {
    const standardBom = await this.fetchStandardBom(standardBomMiCode);
    return {
      standardBomId: Identity.fromString(standardBom.id),
      componentLines: components.map((component) =>
        BomCompositionFactory.buildComponentLine(standardBom, component),
      ),
    };
  }

  private async fetchStandardBom(
    standardBomMiCode: string,
  ): Promise<StandardBomReadModel> {
    try {
      return await this.queryBus.execute<
        GetStandardBomByMiCodeQuery,
        StandardBomReadModel
      >(new GetStandardBomByMiCodeQuery(standardBomMiCode));
    } catch (error) {
      if (error instanceof EntityNotFound) {
        throw BomStandardBomNotFound.withMiCode(standardBomMiCode);
      }
      throw error;
    }
  }

  private static buildComponentLine(
    standardBom: StandardBomReadModel,
    component: BomComponentInput,
  ): BomComponentLine {
    const existingComponent = standardBom.components.find(
      (candidate) => candidate.id === component.componentId,
    );
    if (existingComponent === undefined) {
      throw BomCompositionEntryNotFound.forComponent(component.componentId);
    }

    const materialLines = component.materials.map((material) =>
      BomCompositionFactory.buildMaterialLine(existingComponent, material),
    );

    return BomComponentLine.of(
      Identity.fromString(existingComponent.id),
      existingComponent.name,
      materialLines,
    );
  }

  private static buildMaterialLine(
    component: StandardBomComponent,
    material: BomMaterialInput,
  ): BomMaterialLine {
    const existingMaterial: StandardBomMaterial | undefined =
      component.materials.find(
        (candidate) => candidate.id === material.materialId,
      );
    if (existingMaterial === undefined) {
      throw BomCompositionEntryNotFound.forMaterial(material.materialId);
    }

    return BomMaterialLine.of(
      Identity.fromString(existingMaterial.id),
      existingMaterial.name,
      Weight.ofGrams(material.weight),
    );
  }
}
