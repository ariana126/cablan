import { BomReportFiltersDto } from '@boms/infrastructure/http/controllers/bom/dto/report-boms.dto';
import { ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

// Every field is deliberately `@IsOptional()` with no default value: a
// field *absent* from the request body must stay `undefined` all the way
// down to `ListDashboardProductsHandler`/`BomDashboardRepository` (meaning
// "unfiltered"), matching the same convention `BomReportFiltersDto` uses
// for `registeredAtFrom`/`registeredAtTo`. Neither `@IsOptional()` nor
// `transform: true` in the global `ValidationPipe` coerces a missing key
// into anything else.
//
// `approvalStatuses`/`approvers` are the report's own fields, picked from
// `BomReportFiltersDto` with their validation and Swagger docs, so the two
// endpoints cannot drift apart on them.
export class DashboardProductsDto extends PickType(BomReportFiltersDto, [
  'approvalStatuses',
  'approvers',
] as const) {
  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: '2026-06-21T00:00:00.000Z' })
  from?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: '2026-06-26T00:00:00.000Z' })
  to?: string;
}
