import {
  PM_DASHBOARD_PERIOD_DAYS,
  PmDashboardPeriodDays,
} from '@maintenance/domain/value/pm-dashboard-period.vo';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsUUID } from 'class-validator';

const DEFAULT_PERIOD_DAYS: PmDashboardPeriodDays = 30;

/**
 * The technical management dashboard's period and equipment. A query
 * string carries text, so `periodDays` is read as a number first; anything
 * but 7, 30 or 90 (an empty value included) is a 400 `validation-error`.
 */
export class PmDashboardQueryDto {
  @Type(() => Number)
  @IsOptional()
  @IsIn(PM_DASHBOARD_PERIOD_DAYS)
  @ApiPropertyOptional({
    enum: PM_DASHBOARD_PERIOD_DAYS,
    default: DEFAULT_PERIOD_DAYS,
    description:
      'The last 7, 30 or 90 days, today (Tehran) included. Anything else → 400 validation-error',
  })
  periodDays: number = DEFAULT_PERIOD_DAYS;

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description:
      'Scope every panel but coverage to this piece of equipment. Unknown → 404 entity-not-found',
  })
  equipmentId?: string;
}
