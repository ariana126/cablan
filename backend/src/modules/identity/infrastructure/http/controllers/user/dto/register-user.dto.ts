import { Role } from '@framework/domain';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class RegisterUserDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Sina Ghadrdan' })
  name: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'sina.q' })
  username: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Passw0rd!' })
  password: string;

  @IsEnum(Role)
  @ApiProperty({ enum: Role, enumName: 'Role', example: Role.QcInspector })
  role: Role;
}
