import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RegisterMaterialDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Steel Rod' })
  name: string;
}
