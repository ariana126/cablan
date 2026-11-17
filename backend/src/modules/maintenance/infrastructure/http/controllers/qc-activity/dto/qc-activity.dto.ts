import { MaintenanceNameDto } from '@maintenance/infrastructure/http/controllers/maintenance-name.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

/**
 * A QC activity's name, to define it in the catalog (issue #119): trimmed,
 * required, at most 200 characters — otherwise a 400 on `name`.
 */
export class QcActivityDto extends MaintenanceNameDto {}

/** A QC activity's new name. */
export class RenameQcActivityDto extends MaintenanceNameDto {
  /**
   * The System Admin's confirmation, after a 409 `record-has-dependents`,
   * to correct the name of an activity assigned or recorded anyway. Ignored
   * for anyone else.
   */
  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({
    description:
      'System Admin only: correct the name of a QC activity in use. Ignored for other roles.',
    example: true,
  })
  applyToRelatedRecords?: boolean;
}

/** `/qc-activities/:id` — a malformed id is a 400 on `id`. */
export class QcActivityIdParams {
  @IsUUID()
  id: string;
}
