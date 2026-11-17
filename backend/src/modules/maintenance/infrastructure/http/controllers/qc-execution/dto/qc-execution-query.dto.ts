import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator';

/** An empty query value (`?from=`) is no filter, as an absent one. */
function emptyAsMissing({ value }: { value: unknown }): unknown {
  return value === '' ? undefined : value;
}

/**
 * The QC records' filters (issue #119), each optional and combinable. `from`
 * after `to` is a 400 `validation-error` on `from` (the handler's
 * `InvalidQcExecutionRange`). They narrow the records, never what an
 * interval is measured from.
 */
export class QcExecutionQueryDto {
  @Transform(emptyAsMissing)
  @IsOptional()
  @IsISO8601({ strict: true })
  @ApiPropertyOptional({
    example: '2026-09-23T20:30:00.000Z',
    description: 'ISO instant, inclusive: records performed at or after it',
  })
  from?: string;

  @Transform(emptyAsMissing)
  @IsOptional()
  @IsISO8601({ strict: true })
  @ApiPropertyOptional({
    example: '2026-09-25T20:29:00.000Z',
    description: 'ISO instant, inclusive: records performed at or before it',
  })
  to?: string;

  @Transform(emptyAsMissing)
  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  equipmentId?: string;

  @Transform(emptyAsMissing)
  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  activityId?: string;

  @Transform(emptyAsMissing)
  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'The user who made the record',
  })
  performedById?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'TR-10',
    description:
      'Records whose tracking number contains it, case-insensitive, trimmed; blank is no filter',
  })
  trackingNumber?: string;
}

/** `/qc-executions/:id` — a malformed id is a 400 on `id`. */
export class QcExecutionIdParams {
  @IsUUID()
  id: string;
}
