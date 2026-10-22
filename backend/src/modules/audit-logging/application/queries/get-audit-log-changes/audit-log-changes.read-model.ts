export class AuditLogChangeItem {
  constructor(
    public readonly field: string,
    public readonly previousValue: string,
    public readonly newValue: string,
  ) {}
}

// The reference a reader identifies the entry's record by — e.g.
// `trackingNumber` / `TRK-3005` for a daily BOM's approval.
export class AuditLogSubject {
  constructor(
    public readonly field: string,
    public readonly value: string,
  ) {}
}

export class AuditLogChanges {
  constructor(
    public readonly changes: AuditLogChangeItem[],
    public readonly subject: AuditLogSubject | null,
  ) {}
}
