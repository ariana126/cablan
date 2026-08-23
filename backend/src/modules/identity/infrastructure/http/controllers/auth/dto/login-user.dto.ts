import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginUserDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'sina.q' })
  username: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Passw0rd!' })
  password: string;
}
