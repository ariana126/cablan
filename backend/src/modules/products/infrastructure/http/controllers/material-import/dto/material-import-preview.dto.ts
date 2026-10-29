import { ApiProperty } from '@nestjs/swagger';

const KINDS = ['register', 'changeCode', 'rename', 'unchanged', 'invalid'];
const ERRORS = [
  'name-required',
  'code-required',
  'duplicate-name-in-file',
  'duplicate-code-in-file',
  'code-taken',
  'material-targeted-twice',
];

// Response documentation only: the controller returns the query's read
// model, whose shape these two classes describe as the named
// `MaterialImportPreview`/`MaterialImportPreviewChange` schemas.

export class MaterialImportPreviewChange {
  /** The spreadsheet row number, as Excel shows it. */
  @ApiProperty({ example: 4 })
  row: number;

  /** `unchanged` appears only on a row with errors; `invalid` is a row missing its name or code. */
  @ApiProperty({ enum: KINDS, example: 'changeCode' })
  kind: string;

  /** Normalised (English digits; a code trimmed); `''` when missing. */
  @ApiProperty({ example: 'مسی' })
  name: string;

  @ApiProperty({ example: 'M-201' })
  code: string;

  /** The existing material the row resolves to; null for a registration or an invalid row. */
  @ApiProperty({
    type: String,
    nullable: true,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  materialId: string | null;

  /** That material's current name. */
  @ApiProperty({ type: String, nullable: true, example: 'مسی' })
  previousName: string | null;

  /** That material's current code. */
  @ApiProperty({ type: String, nullable: true, example: 'M-101' })
  previousCode: string | null;

  @ApiProperty({ enum: ERRORS, isArray: true, example: [] })
  errors: string[];
}

export class MaterialImportPreview {
  /** In file order. */
  @ApiProperty({ type: MaterialImportPreviewChange, isArray: true })
  changes: MaterialImportPreviewChange[];
}
