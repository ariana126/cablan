import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';

// Every filter field is deliberately `@IsOptional()` with no default value:
// a field *absent* from the request body must stay `undefined` all the way
// down to `ReportStandardBomsHandler`/`StandardBomReportRepository` (meaning
// "unfiltered"), while a field sent as an empty array must stay `[]` (meaning
// "match nothing") — see `StandardBomReportFilters` and the absent-vs-empty
// rules in reporting-standard-bom.feature. Neither `@IsOptional()` nor
// `transform: true` in the global `ValidationPipe` coerces a missing key into
// `[]`, so no extra handling is needed here to preserve it.
export class StandardBomReportFiltersDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiPropertyOptional({ type: String, isArray: true, example: ['لگراند'] })
  brands?: string[];

  @IsOptional()
  @IsArray()
  @IsBoolean({ each: true })
  @ApiPropertyOptional({ type: Boolean, isArray: true, example: [true] })
  activeStatuses?: boolean[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiPropertyOptional({
    type: String,
    isArray: true,
    example: ['کابل شبکه U/UTP 0.42 LEGRAND'],
  })
  productNames?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiPropertyOptional({ type: String, isArray: true, example: ['مغزی'] })
  componentNames?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiPropertyOptional({ type: String, isArray: true, example: ['1002'] })
  miCodes?: string[];
}

export class ReportStandardBomsDto {
  @IsInt()
  @IsPositive()
  @ApiProperty({ example: 1 })
  page: number;

  @IsInt()
  @IsPositive()
  @ApiProperty({ example: 20 })
  pageSize: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => StandardBomReportFiltersDto)
  @ApiPropertyOptional({ type: StandardBomReportFiltersDto })
  filters?: StandardBomReportFiltersDto;

  @IsOptional()
  @IsIn(['productName'])
  @ApiPropertyOptional({ example: 'productName' })
  sortBy?: 'productName';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  @ApiPropertyOptional({ example: 'asc' })
  sortDir?: 'asc' | 'desc';
}
