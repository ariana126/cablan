import { IntervalUnit } from '@maintenance/domain/value/interval-unit';
import { IsCalendarDate } from '@maintenance/infrastructure/http/is-calendar-date.validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsDefined,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
} from 'class-validator';

export class AddPmPlanItemDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  activityId: string;

  @IsInt()
  @Min(1)
  @ApiProperty({ example: 30, minimum: 1 })
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
  @IsCalendarDate()
  @ApiProperty({
    example: '2026-10-02',
    description: 'ISO date (Gregorian, Tehran calendar day)',
  })
  firstDueDate: string;
}
