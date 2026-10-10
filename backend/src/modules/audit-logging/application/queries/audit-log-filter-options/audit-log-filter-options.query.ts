// Unfiltered — always returns the full distinct value sets, never the values
// left after applying a filter, so a client can populate the audit log's own
// "excel-style" filter lists with every option regardless of the selection
// currently applied elsewhere. Mirrors `BomFilterOptionsQuery`.
export class AuditLogFilterOptionsQuery {}
