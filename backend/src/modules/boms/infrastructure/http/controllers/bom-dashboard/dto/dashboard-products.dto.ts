import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

// Both fields are deliberately `@IsOptional()` with no default value: a
// field *absent* from the request body must stay `undefined` all the way
// down to `ListDashboardProductsHandler`/`BomDashboardRepository` (meaning
// "unfiltered"), matching the same convention `BomReportFiltersDto` uses
// for `registeredAtFrom`/`registeredAtTo`. Neither `@IsOptional()` nor
// `transform: true` in the global `ValidationPipe` coerces a missing key
// into anything else.
export class DashboardProductsDto {
  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: '2026-06-21T00:00:00.000Z' })
  from?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: '2026-06-26T00:00:00.000Z' })
  to?: string;
}
