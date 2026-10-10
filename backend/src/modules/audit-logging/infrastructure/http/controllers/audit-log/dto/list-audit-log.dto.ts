import {
  AuditAction,
  AuditRecordType,
} from '@audit-logging/application/service/audit-log.repository';
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

// Every multi-value field is deliberately `@IsOptional()` with no default: a
// field *absent* from the request must stay `undefined` all the way down
// (meaning "unfiltered"), while one sent as an empty array stays `[]`
// (meaning "match nothing") — the same absent-vs-empty distinction
// `BomReportFiltersDto` documents for the BOM report.
export class AuditLogFiltersDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiPropertyOptional({ type: String, isArray: true, example: ['یاشار'] })
  actors?: string[];

  @IsOptional()
  @IsArray()
  @IsEnum(AuditRecordType, { each: true })
  @ApiPropertyOptional({
    enum: AuditRecordType,
    isArray: true,
    example: ['Bom', 'StandardBom'],
  })
  recordTypes?: AuditRecordType[];

  @IsOptional()
  @IsArray()
  @IsEnum(AuditAction, { each: true })
  @ApiPropertyOptional({
    enum: AuditAction,
    isArray: true,
    example: ['Edited'],
  })
  actions?: AuditAction[];

  // An opaque identifier, not a categorical value — stays a single
  // free-text match rather than a multi-select.
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: '11111111-1111-1111-1111-111111111111' })
  recordId?: string;

  // Inclusive lower bound on `occurredAt`.
  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: '2026-06-21T00:00:00.000Z' })
  from?: string;

  // Inclusive of the *entire calendar day* it names, not merely up to this
  // exact instant — see `ListAuditLogHandler.endOfCalendarDayExclusive()`.
  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ example: '2026-06-26T00:00:00.000Z' })
  to?: string;
}

export class ListAuditLogDto {
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
  @Type(() => AuditLogFiltersDto)
  @ApiPropertyOptional({ type: AuditLogFiltersDto })
  filters?: AuditLogFiltersDto;
}
