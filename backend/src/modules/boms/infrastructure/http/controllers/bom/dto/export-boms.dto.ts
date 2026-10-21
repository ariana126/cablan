import { BomExportFormat } from '@boms/infrastructure/spreadsheet/bom-export-grid';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsTimeZone,
  ValidateNested,
} from 'class-validator';

import { BomReportFiltersDto } from './report-boms.dto';

// Deliberately no `page`/`pageSize`: unlike `ReportBomsDto`, this endpoint
// always exports every matching row. Reuses `BomReportFiltersDto` unchanged,
// so it preserves the same absent-vs-empty-array filter semantics — see that
// file's own comment.
export class ExportBomsDto {
  @IsEnum(BomExportFormat)
  @ApiProperty({
    enum: BomExportFormat,
    enumName: 'BomExportFormat',
    description:
      'Row layout: `perMaterial` — one row per (component, material) entry ("هر مواد اولیه یک ردیف"); `perBom` — one row per daily BOM with a (component, material, weight) column triple per material line, padded with `-` ("هر آنالیز روزانه یک ردیف").',
    example: 'perMaterial',
  })
  format: BomExportFormat;

  @IsString()
  @IsTimeZone()
  @ApiProperty({
    description:
      "The reader's own IANA time zone; the registration time is written as a Jalali date-time in it.",
    example: 'Asia/Tehran',
  })
  timeZone: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => BomReportFiltersDto)
  @ApiPropertyOptional({ type: BomReportFiltersDto })
  filters?: BomReportFiltersDto;
}
