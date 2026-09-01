export class AuditLogChangeItem {
  constructor(
    public readonly field: string,
    public readonly previousValue: string,
    public readonly newValue: string,
  ) {}
}

export class AuditLogChanges {
  constructor(public readonly changes: AuditLogChangeItem[]) {}
}
