import { PmOccurrenceStatus } from '@maintenance/domain/value/pm-occurrence-status';
import { IsCalendarDate } from '@maintenance/infrastructure/http/is-calendar-date.validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

/**
 * The PM schedule's range and filters. `from` and `to` are required by the
 * contract, and documented so, but `@IsOptional` on purpose: a missing one,
 * or a start after the end, is the handler's 400 `invalid-pm-schedule-range`,
 * not a validation error. A malformed date is. That split is why the two
 * disable `api-property-matches-property-optionality`: the spec must say
 * "required" while validation must let an absent bound through.
 */
export class PmScheduleRangeQueryDto {
  // eslint-disable-next-line @darraghor/nestjs-typed/api-property-matches-property-optionality -- required by contract; refused by the handler, not the pipe
  @IsOptional()
  @IsCalendarDate()
  @ApiProperty({
    example: '2026-10-23',
    description: 'ISO date, inclusive. Missing → 400 invalid-pm-schedule-range',
  })
  from: string | undefined;

  // eslint-disable-next-line @darraghor/nestjs-typed/api-property-matches-property-optionality -- required by contract; refused by the handler, not the pipe
  @IsOptional()
  @IsCalendarDate()
  @ApiProperty({
    example: '2026-11-21',
    description:
      'ISO date, inclusive, not before `from`. Missing → 400 invalid-pm-schedule-range',
  })
  to: string | undefined;

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  equipmentId?: string;

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  activityId?: string;

  @IsOptional()
  @IsEnum(PmOccurrenceStatus)
  @ApiPropertyOptional({
    enum: PmOccurrenceStatus,
    enumName: 'PmOccurrenceStatus',
    example: PmOccurrenceStatus.Late,
  })
  status?: PmOccurrenceStatus;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description:
      'The performer’s user id; leaves out every occurrence nobody has done',
  })
  performedById?: string;
}
