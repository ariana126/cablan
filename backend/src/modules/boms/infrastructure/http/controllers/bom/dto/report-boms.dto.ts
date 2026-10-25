import { ApprovalStatus } from '@boms/domain/value/approval-status';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';

// Every field is deliberately `@IsOptional()` with no default value: a field
// *absent* from the request body must stay `undefined` all the way down to
// `ReportBomsHandler`/`BomReportRepository` (meaning "unfiltered"), while a
// field sent as an empty array must stay `[]` (meaning "match nothing") —
// see `BomReportFilters` and reporting-bom.feature's own "انتخاب دوباره همه
// مقادیر"/"عدم انتخاب هیچ مقداری" rules, which are exactly this
// absent-vs-empty distinction. Neither `@IsOptional()` nor `transform: true`
// in the global `ValidationPipe` coerces a missing key into `[]`, so no
// extra handling is needed here to preserve it.
export class BomReportFiltersDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiPropertyOptional({ type: String, isArray: true, example: ['ORD-2001'] })
  orderNumbers?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiPropertyOptional({ type: String, isArray: true, example: ['TRK-3001'] })
  trackingNumbers?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiPropertyOptional({ type: String, isArray: true, example: ['لگراند'] })
  brands?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiPropertyOptional({ type: String, isArray: true, example: ['مغزی'] })
  componentNames?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiPropertyOptional({ type: String, isArray: true, example: ['1001'] })
  standardBomMiCodes?: string[];

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
  @ApiPropertyOptional({
    type: String,
    isArray: true,
    example: ['نیکروش'],
  })
  registeredByUsers?: string[];

  @IsOptional()
  @IsArray()
  @IsEnum(ApprovalStatus, { each: true })
  @ApiPropertyOptional({
    enum: ApprovalStatus,
    enumName: 'BomApprovalStatus',
    isArray: true,
    example: ['pending'],
  })
  approvalStatuses?: ApprovalStatus[];

  // Reviewer display names — a name matches the BOMs that reviewer approved
  // *and* those they rejected — with `''` standing for "no reviewer", i.e.
  // pending BOMs.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiPropertyOptional({
    type: String,
    isArray: true,
    example: ['مصطفی', ''],
    description:
      "Reviewer display names, matching the BOMs each one approved or rejected; `''` matches a BOM with no reviewer (pending). Absent = unfiltered, `[]` = match nothing.",
  })
  reviewers?: string[];

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: '2026-06-21T00:00:00.000Z' })
  registeredAtFrom?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: '2026-06-26T00:00:00.000Z' })
  registeredAtTo?: string;
}

export class ReportBomsDto {
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
  @Type(() => BomReportFiltersDto)
  @ApiPropertyOptional({ type: BomReportFiltersDto })
  filters?: BomReportFiltersDto;
}
