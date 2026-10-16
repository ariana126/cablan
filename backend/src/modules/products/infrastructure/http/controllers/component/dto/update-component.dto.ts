import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

// A component has only a name, so editing it is always a rename — unlike
// `UpdateUserDto`, this field is required rather than optional.
export class UpdateComponentDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Bolt' })
  name: string;
}
