import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * One row of the change list the visitor kept, as the preview listed it. A
 * blank name or code is allowed here: the import refuses it as
 * `material-import-has-invalid-rows`, naming the row, rather than as a
 * validation error. Surrounding whitespace is trimmed, as the preview trims
 * the spreadsheet's cells.
 */
export class ConfirmMaterialImportRowDto {
  /** The spreadsheet row number the preview reported; only echoed back in errors. */
  @IsInt()
  @Min(1)
  @ApiProperty({ example: 3 })
  row: number;

  @Transform(trimmed)
  @IsString()
  @ApiProperty({ example: 'آلومینیوم' })
  name: string;

  @Transform(trimmed)
  @IsString()
  @ApiProperty({ example: 'A-1' })
  code: string;
}

export class ConfirmMaterialImportDto {
  @IsArray()
  @ArrayMaxSize(10_000)
  @ValidateNested({ each: true })
  @Type(() => ConfirmMaterialImportRowDto)
  @ApiProperty({ type: ConfirmMaterialImportRowDto, isArray: true })
  rows: ConfirmMaterialImportRowDto[];
}
