import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

// A component has only a name, so editing it is always a rename — unlike
// `UpdateUserDto`, this field is required rather than optional.
export class UpdateComponentDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Bolt' })
  name: string;

  /**
   * Issue #110: the System Admin's confirmation, after a 409
   * `record-has-dependents`, to correct its name anyway and carry the
   * correction into every related record and snapshot. Ignored for anyone
   * else, and refused (the same 409) when the edit changes anything else.
   */
  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({
    description:
      'System Admin only: apply the correction of its name to every related record and history. Ignored for other roles.',
    example: true,
  })
  applyToRelatedRecords?: boolean;
}
