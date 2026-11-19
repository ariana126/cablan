/** What an uploaded PM plan `.xlsx` would add (issue #127); stores nothing. */
export class PreviewPmPlanImportQuery {
  constructor(public readonly file: Buffer) {}
}
