import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateMaterialDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Steel Rod' })
  name: string;

  // Required and unique. Trimmed before validation, so a whitespace-only code
  // is rejected as empty on the `code` field like a blank name is.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'RM-001' })
  code: string;

  /**
   * Issue #110: the System Admin's confirmation, after a 409
   * `record-has-dependents`, to correct its name and code anyway and carry the
   * correction into every related record and snapshot. Ignored for anyone
   * else, and refused (the same 409) when the edit changes anything else.
   */
  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({
    description:
      'System Admin only: apply the correction of its name and code to every related record and history. Ignored for other roles.',
    example: true,
  })
  applyToRelatedRecords?: boolean;
}
