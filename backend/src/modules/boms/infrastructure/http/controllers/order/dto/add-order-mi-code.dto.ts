import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AddOrderMiCodeDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: '1002' })
  miCode: string;
}
