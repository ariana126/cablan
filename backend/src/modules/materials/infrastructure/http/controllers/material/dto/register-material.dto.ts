import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RegisterMaterialDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Steel Rod' })
  name: string;

  // Optional: missing, `null` or blank all register the material without a
  // code; anything else is stored trimmed.
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ type: String, nullable: true, example: 'RM-001' })
  code?: string | null;
}
