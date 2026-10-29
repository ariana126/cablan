import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class ChangePmPlanItemIntervalDto {
  @IsInt()
  @Min(1)
  @ApiProperty({ example: 15, minimum: 1 })
  intervalDays: number;
}
