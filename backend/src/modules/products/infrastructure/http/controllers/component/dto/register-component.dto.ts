import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RegisterComponentDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Bolt' })
  name: string;
}
