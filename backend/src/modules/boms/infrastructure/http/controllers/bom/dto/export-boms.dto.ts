import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';

import { BomReportFiltersDto } from './report-boms.dto';

// Deliberately no `page`/`pageSize`: unlike `ReportBomsDto`, this endpoint
// always returns every matching row for the frontend to turn into an Excel
// file client-side. Reuses `BomReportFiltersDto` unchanged, so it preserves
// the same absent-vs-empty-array filter semantics — see that file's own
// comment.
export class ExportBomsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => BomReportFiltersDto)
  @ApiPropertyOptional({ type: BomReportFiltersDto })
  filters?: BomReportFiltersDto;
}
