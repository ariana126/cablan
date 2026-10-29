import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

// Recording is always "done, now, by the signed-in user" — notes are the only
// thing a client says. Blank notes are kept as none (`MaintenanceExecution`).
export class RecordMaintenanceExecutionDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'فیلتر هم عوض شد' })
  notes?: string;
}
