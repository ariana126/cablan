import { ApiProperty, OmitType } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

import { RegisterBomDto } from '../../http/controllers/bom/dto/register-bom.dto';

// `POST /boms`'s body, with the MI code required: a legacy daily BOM has no
// order to take its MI code from.
export class LegacyDailyBomDto extends OmitType(RegisterBomDto, [
  'standardBomMiCode',
] as const) {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: '0001', description: "The standard BOM's MI code" })
  standardBomMiCode: string;
}
