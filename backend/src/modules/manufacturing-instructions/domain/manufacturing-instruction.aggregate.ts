import { AggregateRoot, Identity } from '@framework/domain';

import {
  ManufacturingInstructionComponentSnapshot,
  ManufacturingInstructionCompositionReplacement,
  ManufacturingInstructionSnapshot,
} from './events/manufacturing-instruction.snapshot';
import { ManufacturingInstructionDeleted } from './events/manufacturing-instruction-deleted.event';
import {
  ManufacturingInstructionEdited,
  ManufacturingInstructionFieldChange,
} from './events/manufacturing-instruction-edited.event';
import { ManufacturingInstructionRegistered } from './events/manufacturing-instruction-registered.event';
import { Brand } from './value/brand.vo';
import { ManufacturingInstructionComponentLine } from './value/manufacturing-instruction-component-line.vo';
import { MiCode } from './value/mi-code.vo';
import { StandardLength } from './value/standard-length.vo';

export class ManufacturingInstruction extends AggregateRoot {
  private constructor(
    id: Identity,
    private _miCode: MiCode,
    private _brand: Brand,
    private _standardLength: StandardLength,
    private _active: boolean,
    private _description: string | undefined,
    private readonly _productId: Identity,
    // Cloned from the referenced product at registration, exactly like
    // `_productId` itself — immutable afterwards, since the referenced
    // product cannot be changed through an edit (see `edit()`'s doc
    // comment). Lets a client show "نام محصول" without a live join back into
    // `products` on every read.
    private readonly _productName: string,
    private _components: ManufacturingInstructionComponentLine[],
  ) {
    super(id);
  }

  public static register(
    miCode: MiCode,
    brand: Brand,
    standardLength: StandardLength,
    active: boolean,
    description: string | undefined,
    productId: Identity,
    productName: string,
    components: ManufacturingInstructionComponentLine[],
  ): ManufacturingInstruction {
    ManufacturingInstruction.assertHasAtLeastOneComponent(components);
    const manufacturingInstruction = new ManufacturingInstruction(
      Identity.new(),
      miCode,
      brand,
      standardLength,
      active,
      description,
      productId,
      productName,
      components,
    );
    manufacturingInstruction.recordThat(
      new ManufacturingInstructionRegistered(
        manufacturingInstruction.id.asString(),
        manufacturingInstruction.snapshot(),
      ),
    );
    return manufacturingInstruction;
  }

  /**
   * Rehydrates a `ManufacturingInstruction` from storage — for
   * `PrismaManufacturingInstructionRepository`'s `toDomain()` only. Unlike `register()`,
   * this records no event: loading an existing row is not a new business
   * fact.
   */
  public static fromPersistence(
    id: Identity,
    miCode: MiCode,
    brand: Brand,
    standardLength: StandardLength,
    active: boolean,
    description: string | undefined,
    productId: Identity,
    productName: string,
    components: ManufacturingInstructionComponentLine[],
  ): ManufacturingInstruction {
    return new ManufacturingInstruction(
      id,
      miCode,
      brand,
      standardLength,
      active,
      description,
      productId,
      productName,
      components,
    );
  }

  /**
   * Updates the standard BOM's own scalar fields. The referenced product is
   * fixed at registration and cannot be changed through an edit — no
   * scenario requires it, and this keeps a standard BOM's composition
   * traceable to exactly one clone origin.
   *
   * `components`, when given, replaces the component composition wholesale
   * (no partial, line-by-line edit) in the same call, so one edit records at
   * most one `ManufacturingInstructionEdited` event. A composition identical to the
   * current one is not a change, and an edit that changes nothing records
   * no event at all.
   */
  public edit(
    miCode: MiCode,
    brand: Brand,
    standardLength: StandardLength,
    description: string | undefined,
    active: boolean,
    components?: ManufacturingInstructionComponentLine[],
  ): void {
    if (components !== undefined) {
      ManufacturingInstruction.assertHasAtLeastOneComponent(components);
    }
    const changes: ManufacturingInstructionFieldChange[] = [];
    ManufacturingInstruction.recordFieldChange(
      changes,
      'miCode',
      this._miCode.asString(),
      miCode.asString(),
    );
    ManufacturingInstruction.recordFieldChange(
      changes,
      'brand',
      this._brand.asString(),
      brand.asString(),
    );
    ManufacturingInstruction.recordFieldChange(
      changes,
      'standardLength',
      String(this._standardLength.asNumber()),
      String(standardLength.asNumber()),
    );
    ManufacturingInstruction.recordFieldChange(
      changes,
      'description',
      this._description ?? '',
      description ?? '',
    );
    ManufacturingInstruction.recordFieldChange(
      changes,
      'active',
      String(this._active),
      String(active),
    );

    this._miCode = miCode;
    this._brand = brand;
    this._standardLength = standardLength;
    this._description = description;
    this._active = active;

    let replacedComposition: ManufacturingInstructionCompositionReplacement | null =
      null;
    if (
      components !== undefined &&
      !ManufacturingInstruction.sameComposition(this._components, components)
    ) {
      replacedComposition = {
        previous: ManufacturingInstruction.compositionSnapshotOf(
          this._components,
        ),
        current: ManufacturingInstruction.compositionSnapshotOf(components),
      };
      this._components = components;
    }

    if (changes.length === 0 && replacedComposition === null) {
      return;
    }
    this.recordThat(
      new ManufacturingInstructionEdited(
        this.id.asString(),
        miCode.asString(),
        brand.asString(),
        standardLength.asNumber(),
        description,
        active,
        changes,
        replacedComposition,
      ),
    );
  }

  public delete(): void {
    this.recordThat(
      new ManufacturingInstructionDeleted(this.id.asString(), this.snapshot()),
    );
  }

  public miCode(): MiCode {
    return this._miCode;
  }

  public brand(): Brand {
    return this._brand;
  }

  public standardLength(): StandardLength {
    return this._standardLength;
  }

  public active(): boolean {
    return this._active;
  }

  public description(): string | undefined {
    return this._description;
  }

  public productId(): Identity {
    return this._productId;
  }

  public productName(): string {
    return this._productName;
  }

  public components(): ManufacturingInstructionComponentLine[] {
    return this._components;
  }

  private snapshot(): ManufacturingInstructionSnapshot {
    return {
      miCode: this._miCode.asString(),
      brand: this._brand.asString(),
      standardLength: this._standardLength.asNumber(),
      active: this._active,
      description: this._description,
      productId: this._productId.asString(),
      productName: this._productName,
      components: ManufacturingInstruction.compositionSnapshotOf(
        this._components,
      ),
    };
  }

  private static compositionSnapshotOf(
    components: ManufacturingInstructionComponentLine[],
  ): ManufacturingInstructionComponentSnapshot[] {
    return components.map((component) => ({
      name: component.name(),
      materials: component.materials().map((material) => ({
        name: material.name(),
        weightInGrams: material.weight().asGrams(),
      })),
    }));
  }

  private static assertHasAtLeastOneComponent(
    components: ManufacturingInstructionComponentLine[],
  ): void {
    if (components.length === 0) {
      throw new Error('A standard BOM must have at least one component');
    }
  }

  private static sameComposition(
    current: ManufacturingInstructionComponentLine[],
    next: ManufacturingInstructionComponentLine[],
  ): boolean {
    return (
      current.length === next.length &&
      current.every((line, index) => line.equals(next[index]))
    );
  }

  /**
   * Appends a `ManufacturingInstructionFieldChange` only when `previousValue` and
   * `newValue` actually differ — a field resent unchanged (the common case,
   * since `EditManufacturingInstructionHandler` always passes every field's *resolved*
   * value, changed or not) never appears in `ManufacturingInstructionEdited.changes`.
   */
  private static recordFieldChange(
    changes: ManufacturingInstructionFieldChange[],
    field: string,
    previousValue: string,
    newValue: string,
  ): void {
    if (previousValue !== newValue) {
      changes.push({ field, previousValue, newValue });
    }
  }
}
