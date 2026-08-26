import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';

// Every `componentId`/`materialId` here must already exist in the referenced
// product's *current* composition — this module never creates a new
// `Component`/`Material` master row, unlike `products`' own composition
// input (see `StandardBomCompositionFactory` and
// src/modules/standard-boms/CLAUDE.md). The same shape is reused verbatim by
// `UpdateStandardBomDto`, since registering and editing a Standard BOM's
// composition validate and clone identically.
export class RegisterStandardBomMaterialDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
  materialId: string;

  @IsNumber()
  @IsPositive()
  @ApiProperty({ example: 150, description: 'Weight in grams' })
  weight: number;
}

export class RegisterStandardBomComponentDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  componentId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RegisterStandardBomMaterialDto)
  @ApiProperty({ type: RegisterStandardBomMaterialDto, isArray: true })
  materials: RegisterStandardBomMaterialDto[];
}

// The "at least one component"/"at least one material" invariants are
// deliberately *not* enforced here with an array-length validator: those are
// this module's own business rules
// (`StandardBomMustHaveAtLeastOneComponent`/
// `StandardBomComponentMustHaveAtLeastOneMaterial`), surfaced as their own
// problem type rather than a generic validation error — mirroring
// `RegisterProductDto`.
//
// `active` deliberately carries no `@IsOptional()`: a request that omits it
// entirely fails `@IsBoolean()` against `undefined`, which is what makes
// omitting it a 400 distinct from explicitly sending `false`. See
// src/modules/standard-boms/CLAUDE.md.
export class RegisterStandardBomDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  productId: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: '1234' })
  miCode: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Legrand' })
  brand: string;

  @IsNumber()
  @IsPositive()
  @ApiProperty({ example: 305, description: 'Cable length per drum' })
  standardLength: number;

  @IsBoolean()
  @ApiProperty({ example: true })
  active: boolean;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Standard for network cables' })
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RegisterStandardBomComponentDto)
  @ApiProperty({ type: RegisterStandardBomComponentDto, isArray: true })
  components: RegisterStandardBomComponentDto[];
}
