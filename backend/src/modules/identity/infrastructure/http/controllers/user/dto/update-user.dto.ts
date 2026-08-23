import { Role } from '@framework/domain';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

// Every field is optional (a partial edit), but a field that *is* present
// must not be empty — `@IsOptional()` skips the other validators only when
// the property is missing entirely, not when it's an empty string, so
// explicitly clearing a field is still rejected.
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @ApiPropertyOptional({ example: 'Sina Ghadrdan' })
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @ApiPropertyOptional({ example: 'sina.q' })
  username?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @ApiPropertyOptional({ example: 'NewPassw0rd!' })
  password?: string;

  @IsOptional()
  @IsEnum(Role)
  @ApiPropertyOptional({
    enum: Role,
    enumName: 'Role',
    example: Role.Management,
  })
  role?: Role;
}
