import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * A name for equipment or for a maintenance activity — trimmed before it is
 * validated, so a blank name is a 400 on `name` rather than a 500 out of the
 * name value object. Each controller names its own subclass, so the OpenAPI
 * schema reads per use.
 */
export class MaintenanceNameDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @ApiProperty({ example: 'اکسترودر ۱', maxLength: 200 })
  name: string;
}
