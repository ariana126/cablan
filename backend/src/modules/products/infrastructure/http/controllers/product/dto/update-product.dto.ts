import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

// A composition entry that carries an `id` refers to a component/material
// already part of this product's *current* composition and is kept as-is;
// one with no `id` is registered brand new — exactly like
// `RegisterProductComponentDto`/`RegisterProductMaterialDto`, which stay
// id-less since registration never has an existing composition to reconcile
// against. See `ProductCompositionFactory.reconcileComponentLines` and
// src/modules/products/CLAUDE.md.
export class EditProductMaterialDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440002' })
  id?: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Steel Rod' })
  name: string;
}

export class EditProductComponentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440001' })
  id?: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Bolt' })
  name: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EditProductMaterialDto)
  @ApiProperty({ type: EditProductMaterialDto, isArray: true })
  materials: EditProductMaterialDto[];
}

// A partial edit, mirroring `UpdateUserDto`: `name` and `components` are each
// optional and independently updatable (see `EditProductCommand`), but a
// field that *is* present must still be well-formed — `@IsOptional()` skips
// the other validators only when the property is missing entirely.
export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @ApiPropertyOptional({ example: 'Gadget' })
  name?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EditProductComponentDto)
  @ApiPropertyOptional({ type: EditProductComponentDto, isArray: true })
  components?: EditProductComponentDto[];
}
