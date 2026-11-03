import { ACTIVITY_SPECIALTIES } from '@maintenance/domain/value/activity-specialty.vo';
import { MaintenanceNameDto } from '@maintenance/infrastructure/http/controllers/maintenance-name.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

/**
 * An activity's name and its one specialty, to register it in the catalog
 * or edit it. A missing, unknown or doubled specialty (`["electrical",
 * "mechanical"]`) is a 400 on `specialty`.
 */
export class MaintenanceActivityDto extends MaintenanceNameDto {
  @IsIn(ACTIVITY_SPECIALTIES)
  @ApiProperty({
    enum: ACTIVITY_SPECIALTIES,
    enumName: 'ActivitySpecialty',
    example: 'mechanical',
    description: '«برق» (electrical) or «مکانیک» (mechanical)',
  })
  specialty: string;
}
