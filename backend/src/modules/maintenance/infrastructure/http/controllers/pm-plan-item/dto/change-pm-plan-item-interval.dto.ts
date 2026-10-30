import { MAX_INTERVAL_DAYS } from '@maintenance/domain/value/interval-days.vo';
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class ChangePmPlanItemIntervalDto {
  @IsInt()
  @Min(1)
  @Max(MAX_INTERVAL_DAYS)
  @ApiProperty({ example: 15, minimum: 1, maximum: MAX_INTERVAL_DAYS })
  intervalDays: number;
}
