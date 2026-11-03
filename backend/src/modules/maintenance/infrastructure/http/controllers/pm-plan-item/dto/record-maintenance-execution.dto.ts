import { MAX_OPERATING_HOURS } from '@maintenance/domain/value/operating-hours.vo';
import { IsOperatingHours } from '@maintenance/infrastructure/http/is-operating-hours.validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

/** `null` is no value, as an absent one — never a value object's input. */
function nullAsMissing({ value }: { value: unknown }): unknown {
  return value === null ? undefined : value;
}

// Recording is always "done, now, by the signed-in user" — notes and the
// equipment's operating hours are all a client says. Blank notes are kept as
// none (`MaintenanceExecution`).
export class RecordMaintenanceExecutionDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @ApiPropertyOptional({ example: 'فیلتر هم عوض شد', maxLength: 2000 })
  notes?: string;

  @Transform(nullAsMissing)
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsOperatingHours()
  @ApiPropertyOptional({
    example: 1250.5,
    minimum: 0,
    maximum: MAX_OPERATING_HOURS,
    description:
      'The equipment’s operating hours since the activity was last done on it, at most two decimals. Never compared with earlier executions; null is the same as absent',
  })
  operatingHours?: number;
}
