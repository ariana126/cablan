import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

// A partial edit: a field left out stays as it is. `@ValidateIf` rather than
// `@IsOptional()` on the two fields, so an explicit `null` is still refused.
export class UpdateOrderDto {
  @ValidateIf((dto: UpdateOrderDto) => dto.orderNumber !== undefined)
  @IsString()
  @IsNotEmpty()
  @ApiPropertyOptional({ example: 'ORD-5010' })
  orderNumber?: string;

  @ValidateIf((dto: UpdateOrderDto) => dto.miCodes !== undefined)
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @ApiPropertyOptional({
    type: String,
    isArray: true,
    example: ['1001'],
    description: "Replaces the order's MI codes; at least one",
  })
  miCodes?: string[];

  /**
   * Issue #110: the System Admin's confirmation, after a 409
   * `record-has-dependents`, to correct the number of an order in use and
   * carry it into its daily BOMs. Ignored for anyone else, and refused (the
   * same 409) when the edit changes the MI codes too.
   */
  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({
    description:
      "System Admin only: apply the correction of the order number to every daily BOM of the order. Ignored for other roles; never allows changing an order in use's MI codes.",
    example: true,
  })
  applyToRelatedRecords?: boolean;
}
