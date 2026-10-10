import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

// `name` stays required, as before. `code` is tri-state: absent leaves the
// current code untouched, `null` or a blank string clears it, anything else
// sets it (trimmed).
export class UpdateMaterialDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Steel Rod' })
  name: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'RM-001',
    description:
      'Omit to leave the code unchanged; send null or a blank string to clear it.',
  })
  code?: string | null;
}
