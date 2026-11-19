/**
 * Add every new plan item of an uploaded PM plan `.xlsx` (issue #127) — the
 * same file the preview was given, checked again, never a diff the client
 * sends.
 */
export class ImportPmPlansCommand {
  constructor(public readonly file: Buffer) {}
}
