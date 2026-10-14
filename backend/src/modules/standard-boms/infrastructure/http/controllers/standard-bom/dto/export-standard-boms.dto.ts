import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StandardBomExportFormat } from '@standard-boms/infrastructure/spreadsheet/standard-bom-export-grid';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, ValidateNested } from 'class-validator';

import { StandardBomReportFiltersDto } from './report-standard-boms.dto';

// Deliberately no `page`/`pageSize`: unlike `ReportStandardBomsDto`, this
// endpoint always exports every matching row. Reuses
// `StandardBomReportFiltersDto` unchanged, so it preserves the same
// absent-vs-empty-array filter semantics — see that file's own comment.
// Mirrors `boms/`'s own `ExportBomsDto`, minus `timeZone`: nothing in this
// export is a point in time.
export class ExportStandardBomsDto {
  @IsEnum(StandardBomExportFormat)
  @ApiProperty({
    enum: StandardBomExportFormat,
    enumName: 'StandardBomExportFormat',
    description:
      'Row layout: `perMaterial` — one row per (component, material) entry ("هر مواد اولیه یک ردیف"); `perBom` — one row per standard BOM with a (material, weight) column pair per component material slot ("هر آنالیز استاندارد یک ردیف").',
    example: 'perMaterial',
  })
  format: StandardBomExportFormat;

  @IsOptional()
  @ValidateNested()
  @Type(() => StandardBomReportFiltersDto)
  @ApiPropertyOptional({ type: StandardBomReportFiltersDto })
  filters?: StandardBomReportFiltersDto;
}
