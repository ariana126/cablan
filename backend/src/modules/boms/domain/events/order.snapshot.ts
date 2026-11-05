// Plain-data snapshots of an order, as carried by its domain events — so a
// subscriber (audit-logging) can show what was defined or removed without
// reaching into this module's value objects.
export interface OrderMiCodeSnapshot {
  readonly miCode: string;
  readonly productName: string;
}

export interface OrderSnapshot {
  readonly orderNumber: string;
  readonly miCodes: readonly OrderMiCodeSnapshot[];
}
