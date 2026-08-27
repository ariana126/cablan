import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { RegisterBomComponentDto } from './register-bom.dto';

// A partial edit, mirroring `UpdateStandardBomDto`: every field is optional
// and independently updatable (see `EditBomCommand`), but a field that *is*
// present must still be well-formed.
//
// `orderNumber`/`trackingNumber` deliberately skip `@IsOptional()` in favour
// of `@ValidateIf`, the same substitution `UpdateStandardBomDto.standardLength`
// makes: `@IsOptional()` treats a missing key *and* an explicit `null` as
// "skip validation" alike, which would let a cleared text input's `null`
// slip past `@IsNotEmpty()` untouched — exactly the "پاک کردن شماره
// سفارش/ردیابی" scenarios `registring-bom.feature` rejects as a validation
// error, not a silent no-op edit. `@ValidateIf` only skips validation when
// the key is missing entirely (`undefined`, "leave unchanged"); an explicit
// `null` still runs `@IsString()`/`@IsNotEmpty()` and is rejected as an
// ordinary 400.
//
// `description`, by contrast, may be cleared freely — no `@ValidateIf` guard,
// mirroring how `description` behaves on `UpdateStandardBomDto`.
//
// `components`, when given, replaces the whole composition wholesale (see
// `Bom.updateComponents()`'s doc comment) and reuses `RegisterBomComponentDto`
// verbatim — there is no id-optional "new vs. reused" variant, since this
// module never creates a new `Component`/`Material` master row.
//
// `standardBomMiCode` is guarded the other way around: it is only validated
// — and so only required — when `components` is also given, mirroring
// `EditBomCommand`'s own "required in practice, not in type" note (see
// src/modules/boms/CLAUDE.md). Supplying `components` without it is an
// ordinary 400 before a command is ever constructed.
export class UpdateBomDto {
  @ValidateIf((dto: UpdateBomDto) => dto.orderNumber !== undefined)
  @IsString()
  @IsNotEmpty()
  @ApiPropertyOptional({ example: 'SO-9999' })
  orderNumber?: string;

  @ValidateIf((dto: UpdateBomDto) => dto.trackingNumber !== undefined)
  @IsString()
  @IsNotEmpty()
  @ApiPropertyOptional({ example: 'TN-0000' })
  trackingNumber?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Updated description' })
  description?: string;

  @ValidateIf((dto: UpdateBomDto) => dto.components !== undefined)
  @IsString()
  @IsNotEmpty()
  @ApiPropertyOptional({
    example: '0001',
    description: "The standard BOM's MI code",
  })
  standardBomMiCode?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RegisterBomComponentDto)
  @ApiPropertyOptional({
    type: RegisterBomComponentDto,
    isArray: true,
  })
  components?: RegisterBomComponentDto[];
}
