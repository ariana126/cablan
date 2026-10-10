// Plain-data snapshots of a daily BOM, as carried by its domain events — so a
// subscriber (e.g. audit-logging) can show what was registered, replaced or
// removed without reaching into this module's value objects.
export interface BomMaterialSnapshot {
  readonly name: string;
  readonly weightInGrams: number;
}

export interface BomComponentSnapshot {
  readonly name: string;
  readonly materials: readonly BomMaterialSnapshot[];
}

export interface BomSnapshot {
  readonly standardBomId: string;
  readonly standardBomMiCode: string;
  readonly brand: string;
  readonly productName: string;
  readonly standardLength: number;
  readonly orderNumber: string;
  readonly trackingNumber: string;
  readonly description: string | undefined;
  readonly registeredBy: string;
  readonly components: readonly BomComponentSnapshot[];
}

// The composition before and after an edit that replaced it wholesale.
export interface BomCompositionReplacement {
  readonly previous: readonly BomComponentSnapshot[];
  readonly current: readonly BomComponentSnapshot[];
}
