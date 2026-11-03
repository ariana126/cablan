import { ACTIVITY_SPECIALTIES } from '@maintenance/domain/value/activity-specialty.vo';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsUUID, ValidateNested } from 'class-validator';

/** One activity without a specialty, and the specialty it is given. */
export class SpecialtyAssignmentDto {
  @IsUUID()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  activityId: string;

  @IsIn(ACTIVITY_SPECIALTIES)
  @ApiProperty({
    enum: ACTIVITY_SPECIALTIES,
    enumName: 'ActivitySpecialty',
    example: 'electrical',
  })
  specialty: string;
}

/**
 * A specialty for every activity without one, all at once. Naming them all
 * and nothing else is the handler's rule (400
 * `specialty-assignment-incomplete`); a malformed entry is a 400 on
 * `assignments`.
 */
export class CompleteMissingSpecialtiesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpecialtyAssignmentDto)
  @ApiProperty({ type: SpecialtyAssignmentDto, isArray: true })
  assignments: SpecialtyAssignmentDto[];
}
