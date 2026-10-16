// Plain-data snapshots of a standard BOM, as carried by its domain events —
// so a subscriber (e.g. audit-logging) can show what was registered,
// replaced or removed without reaching into this module's value objects.
export interface ManufacturingInstructionMaterialSnapshot {
  readonly name: string;
  readonly weightInGrams: number;
}

export interface ManufacturingInstructionComponentSnapshot {
  readonly name: string;
  readonly materials: readonly ManufacturingInstructionMaterialSnapshot[];
}

export interface ManufacturingInstructionSnapshot {
  readonly miCode: string;
  readonly brand: string;
  readonly standardLength: number;
  readonly active: boolean;
  readonly description: string | undefined;
  readonly productId: string;
  readonly productName: string;
  readonly components: readonly ManufacturingInstructionComponentSnapshot[];
}

// The composition before and after an edit that replaced it wholesale.
export interface ManufacturingInstructionCompositionReplacement {
  readonly previous: readonly ManufacturingInstructionComponentSnapshot[];
  readonly current: readonly ManufacturingInstructionComponentSnapshot[];
}
