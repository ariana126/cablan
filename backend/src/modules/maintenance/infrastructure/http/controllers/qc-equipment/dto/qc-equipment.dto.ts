import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/** `/…/:equipmentId` — a malformed id is a 400 on `equipmentId`. */
export class QcEquipmentIdParams {
  @IsUUID()
  equipmentId: string;
}

/** `/qc-equipment/:equipmentId/activities/:activityId[/executions]`. */
export class QcAssignmentParams extends QcEquipmentIdParams {
  @IsUUID()
  activityId: string;
}

/** The QC activity assigned to the equipment. */
export class AssignQcActivityDto {
  @IsUUID()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  activityId: string;
}

/**
 * That the activity was done — now, by the signed-in user, which the body
 * never says. The tracking number is any text, trimmed and required (blank
 * is a 400 on `trackingNumber`); notes are optional, blank kept as none.
 */
export class RecordQcExecutionDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @ApiProperty({ example: 'TR-100', maxLength: 100 })
  trackingNumber: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @ApiPropertyOptional({ example: 'خراش جزئی روی روکش', maxLength: 2000 })
  notes?: string;
}
