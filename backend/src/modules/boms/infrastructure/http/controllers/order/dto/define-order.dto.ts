import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsNotEmpty, IsString } from 'class-validator';

// An empty order number, or no MI code at all, is an ordinary 400
// `validation-error` (fields `orderNumber` / `miCodes`); the same MI code
// twice is the order's own 409 `order-mi-code-already-assigned`.
export class DefineOrderDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'ORD-5001',
    description:
      'Unique; Persian digits are stored as English ones (else 409 `order-number-taken`)',
  })
  orderNumber: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @ApiProperty({
    type: String,
    isArray: true,
    example: ['1001', '1002'],
    description:
      'The MI codes of the standard BOMs assigned to the order, at least one, in assignment order (else 400 `order-mi-code-not-found` for one naming no standard BOM)',
  })
  miCodes: string[];
}
