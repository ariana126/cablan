import { MAX_INTERVAL_DAYS } from '@maintenance/domain/value/interval-days.vo';
import { IntervalUnit } from '@maintenance/domain/value/interval-unit';
import { IsCalendarDate } from '@maintenance/infrastructure/http/is-calendar-date.validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsDefined,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class AddPmPlanItemDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  activityId: string;

  @IsInt()
  @Min(1)
  @Max(MAX_INTERVAL_DAYS)
  @ApiProperty({ example: 30, minimum: 1, maximum: MAX_INTERVAL_DAYS })
  intervalValue: number;

  // Both units are accepted here; the domain refuses `operating_hours` with
  // `usage-based-interval-not-supported`, since the plan can only be defined
  // in days for now.
  @IsEnum(IntervalUnit)
  @ApiProperty({
    enum: IntervalUnit,
    enumName: 'IntervalUnit',
    example: IntervalUnit.Days,
  })
  intervalUnit: IntervalUnit;

  @IsDefined()
  @IsString()
  @IsCalendarDate({ from: 2000, to: 2100 })
  @ApiProperty({
    example: '2026-10-02',
    description: 'ISO date (Gregorian, Tehran calendar day), years 2000–2100',
  })
  firstDueDate: string;
}
