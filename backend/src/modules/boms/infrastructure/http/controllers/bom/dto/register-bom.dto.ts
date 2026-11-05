import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

// Every `componentId`/`materialId` here must already exist in the referenced
// standard BOM's *current* composition — this module never creates a new
// `Component`/`Material` master row, mirroring `manufacturing-instructions`' own
// composition input (see `BomCompositionFactory` and
// src/modules/boms/CLAUDE.md). The same shape is reused verbatim by
// `UpdateBomDto`, since registering and editing a daily BOM's composition
// validate and clone identically. `weight` gets the same `@IsNumber()
// @IsPositive()` pair `RegisterStandardBomMaterialDto.weight` does, so
// leaving it empty and setting it to zero collapse into the same generic
// validation error — matching `registring-bom.feature`'s own single shared
// "پیغام خطای وزن مواد اولیه نامعتبر" message for both.
export class RegisterBomMaterialDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
  materialId: string;

  @IsNumber()
  @IsPositive()
  @ApiProperty({ example: 150, description: 'Weight in grams' })
  weight: number;
}

export class RegisterBomComponentDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  componentId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RegisterBomMaterialDto)
  @ApiProperty({ type: RegisterBomMaterialDto, isArray: true })
  materials: RegisterBomMaterialDto[];
}

// The "at least one component"/"at least one material" invariants are
// deliberately *not* enforced here with an array-length validator: those are
// this module's own business rules (`BomMustHaveAtLeastOneComponent`/
// `BomComponentMustHaveAtLeastOneMaterial`), surfaced as their own problem
// type rather than a generic validation error — mirroring
// `RegisterStandardBomDto`.
export class RegisterBomDto {
  // Issue #101: one of the order's MI codes; left out, the order's only one
  // (400 `bom-mi-code-required` when it has several). `@ValidateIf` rather
  // than `@IsOptional()`, so an explicit `null` or `''` is still refused.
  @ValidateIf((dto: RegisterBomDto) => dto.standardBomMiCode !== undefined)
  @IsString()
  @IsNotEmpty()
  @ApiPropertyOptional({
    example: '0001',
    description:
      "The standard BOM's MI code: one of the order's MI codes (else 400 `bom-mi-code-not-in-order`). May be left out when the order has exactly one, which is then used; required when it has several (400 `bom-mi-code-required`).",
  })
  standardBomMiCode?: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'SO-1234',
    description:
      'The number of a defined order (Persian digits read as English ones); else 400 `bom-order-not-defined`',
  })
  orderNumber: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'TN-5678' })
  trackingNumber: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Daily BOM for order SO-1234' })
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RegisterBomComponentDto)
  @ApiProperty({ type: RegisterBomComponentDto, isArray: true })
  components: RegisterBomComponentDto[];
}
