import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';

// Nested component/material names are validated here the same way a
// top-level `RegisterComponentDto`/`RegisterMaterialDto` name is — so an
// empty nested name is rejected as an ordinary 400 validation error before
// `ProductCompositionFactory` ever builds a `ComponentName`/`MaterialName`
// from it (which would otherwise throw a plain, unmapped `Error`). See
// src/modules/products/CLAUDE.md.
//
// The "at least one component"/"at least one material" invariants are
// deliberately *not* enforced here with an array-length validator: those are
// this module's own business rules
// (`ProductMustHaveAtLeastOneComponent`/`ProductComponentMustHaveAtLeastOneMaterial`),
// surfaced as their own problem type rather than a generic validation error.
export class RegisterProductMaterialDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Steel Rod' })
  name: string;
}

export class RegisterProductComponentDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Bolt' })
  name: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RegisterProductMaterialDto)
  @ApiProperty({ type: RegisterProductMaterialDto, isArray: true })
  materials: RegisterProductMaterialDto[];
}

export class RegisterProductDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Widget' })
  name: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RegisterProductComponentDto)
  @ApiProperty({ type: RegisterProductComponentDto, isArray: true })
  components: RegisterProductComponentDto[];
}
