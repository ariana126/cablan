import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

// A material has only a name, so editing it is always a rename — unlike
// `UpdateUserDto`, this field is required rather than optional.
export class UpdateMaterialDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Steel Rod' })
  name: string;
}
