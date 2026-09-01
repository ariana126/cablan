import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class ListAuditLogDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'یاشار' })
  actorName?: string;

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

  @IsInt()
  @IsPositive()
  @ApiProperty({ example: 1 })
  page: number;

  @IsInt()
  @IsPositive()
  @ApiProperty({ example: 20 })
  pageSize: number;
}
