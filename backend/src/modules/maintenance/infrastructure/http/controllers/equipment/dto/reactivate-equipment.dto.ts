import { IsCalendarDate } from '@maintenance/infrastructure/http/is-calendar-date.validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

/** An active row given a new first due date, keeping its interval. */
export class RescheduledPlanItemDto {
  @IsUUID()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  planItemId: string;

  @IsDefined()
  @IsString()
  @IsCalendarDate({ from: 2000, to: 2100 })
  @ApiProperty({
    example: '2026-10-17',
    description:
      'ISO date (Gregorian, Tehran calendar day), years 2000–2100; today or later',
  })
  firstDueDate: string;
}

/**
 * Retired equipment back in service (issue #110). Each active row listed
 * restarts from its new first due date; every other active row continues
 * its previous calendar. Deactivated rows stay deactivated.
 */
export class ReactivateEquipmentDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RescheduledPlanItemDto)
  @ApiPropertyOptional({
    type: RescheduledPlanItemDto,
    isArray: true,
    description:
      'The active rows given a new first due date; none listed (or absent) continues every row’s calendar',
  })
  rescheduledItems?: RescheduledPlanItemDto[];
}
