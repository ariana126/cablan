import { ACTIVITY_SPECIALTIES } from '@maintenance/domain/value/activity-specialty.vo';
import { PmOccurrenceStatus } from '@maintenance/domain/value/pm-occurrence-status';
import { IsCalendarDate } from '@maintenance/infrastructure/http/is-calendar-date.validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

/** The years a bound may fall in — `firstDueDate`'s window. */
const RANGE_YEARS = { from: 2000, to: 2100 };

/** An empty query value (`?from=`) is a missing one. */
function emptyAsMissing({ value }: { value: unknown }): unknown {
  return value === '' ? undefined : value;
}

/**
 * The PM schedule's range and filters. `from` and `to` are required by the
 * contract, and documented so, but `@IsOptional` on purpose: a missing (or
 * empty) one, a start after the end, or a span over ten years is the
 * handler's 400 `invalid-pm-schedule-range`, not a validation error. A
 * malformed date, or one outside years 2000–2100, is. That split is why the
 * two disable `api-property-matches-property-optionality`: the spec must say
 * "required" while validation must let an absent bound through.
 */
export class PmScheduleRangeQueryDto {
  // eslint-disable-next-line @darraghor/nestjs-typed/api-property-matches-property-optionality -- required by contract; refused by the handler, not the pipe
  @Transform(emptyAsMissing)
  @IsOptional()
  @IsCalendarDate(RANGE_YEARS)
  @ApiProperty({
    example: '2026-10-23',
    description:
      'ISO date, inclusive, years 2000–2100. Missing or empty → 400 invalid-pm-schedule-range',
  })
  from: string | undefined;

  // eslint-disable-next-line @darraghor/nestjs-typed/api-property-matches-property-optionality -- required by contract; refused by the handler, not the pipe
  @Transform(emptyAsMissing)
  @IsOptional()
  @IsCalendarDate(RANGE_YEARS)
  @ApiProperty({
    example: '2026-11-21',
    description:
      'ISO date, inclusive, years 2000–2100, not before `from`, at most 3660 days from it (both counted). Missing or empty, reversed or too long → 400 invalid-pm-schedule-range',
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
  @IsIn(ACTIVITY_SPECIALTIES)
  @ApiPropertyOptional({
    enum: ACTIVITY_SPECIALTIES,
    enumName: 'ActivitySpecialty',
    example: 'electrical',
    description:
      'Only activities of this specialty; an activity without a specialty is never among them',
  })
  specialty?: string;

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
