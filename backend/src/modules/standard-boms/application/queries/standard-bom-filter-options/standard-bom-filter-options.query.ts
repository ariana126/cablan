// Unfiltered — always returns the full distinct value sets, never the values
// left after applying a filter, so a client can populate the report's own
// "excel-style" filter dropdowns with every option regardless of the
// selection currently applied elsewhere in the list.
export class StandardBomFilterOptionsQuery {}
