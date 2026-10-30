import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

// Recording is always "done, now, by the signed-in user" — notes are the only
// thing a client says. Blank notes are kept as none (`MaintenanceExecution`).
export class RecordMaintenanceExecutionDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @ApiPropertyOptional({ example: 'فیلتر هم عوض شد', maxLength: 2000 })
  notes?: string;
}
