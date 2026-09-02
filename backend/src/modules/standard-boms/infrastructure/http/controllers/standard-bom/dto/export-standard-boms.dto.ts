import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';

import { StandardBomReportFiltersDto } from './report-standard-boms.dto';

// Deliberately no `page`/`pageSize`: unlike `ReportStandardBomsDto`, this
// endpoint always returns every matching row for the frontend to turn into
// an Excel file client-side. Reuses `StandardBomReportFiltersDto` unchanged,
// so it preserves the same absent-vs-empty-array filter semantics — see that
// file's own comment. Mirrors `boms/`'s own `ExportBomsDto`.
export class ExportStandardBomsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => StandardBomReportFiltersDto)
  @ApiPropertyOptional({ type: StandardBomReportFiltersDto })
  filters?: StandardBomReportFiltersDto;
}
