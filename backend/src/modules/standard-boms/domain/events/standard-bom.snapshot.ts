// Plain-data snapshots of a standard BOM, as carried by its domain events —
// so a subscriber (e.g. audit-logging) can show what was registered,
// replaced or removed without reaching into this module's value objects.
export interface StandardBomMaterialSnapshot {
  readonly name: string;
  readonly weightInGrams: number;
}

export interface StandardBomComponentSnapshot {
  readonly name: string;
  readonly materials: readonly StandardBomMaterialSnapshot[];
}

export interface StandardBomSnapshot {
  readonly miCode: string;
  readonly brand: string;
  readonly standardLength: number;
  readonly active: boolean;
  readonly description: string | undefined;
  readonly productId: string;
  readonly productName: string;
  readonly components: readonly StandardBomComponentSnapshot[];
}

// The composition before and after an edit that replaced it wholesale.
export interface StandardBomCompositionReplacement {
  readonly previous: readonly StandardBomComponentSnapshot[];
  readonly current: readonly StandardBomComponentSnapshot[];
}
