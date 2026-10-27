import { PickType } from '@nestjs/swagger';

import { RegisterBomDto } from './register-bom.dto';

// Re-sampling («نمونه گیری مجدد») a rejected daily BOM: only what a new sample
// changes — the weights and an optional description — in registration's own
// shape and validation (`PickType` carries the decorators and the Swagger
// docs over). The order number, tracking number and MI code are not
// accepted: they are read from the rejected BOM, which is what makes them
// unchangeable, and the validation pipe's `forbidNonWhitelisted` turns any
// of them in the body into a 400.
export class ResampleBomDto extends PickType(RegisterBomDto, [
  'components',
  'description',
] as const) {}
