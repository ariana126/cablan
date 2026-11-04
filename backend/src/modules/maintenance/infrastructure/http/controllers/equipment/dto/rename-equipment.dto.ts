import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

import { EquipmentNameDto } from './equipment-name.dto';

/** A piece of equipment's new name. */
export class RenameEquipmentDto extends EquipmentNameDto {
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
