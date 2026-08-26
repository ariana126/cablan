import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { RegisterStandardBomComponentDto } from './register-standard-bom.dto';

// A partial edit, mirroring `UpdateProductDto`: every field is optional and
// independently updatable (see `EditStandardBomCommand`), but a field that
// *is* present must still be well-formed — `@IsOptional()` skips the other
// validators only when the property is missing entirely. `components`, when
// given, replaces the whole composition wholesale (see
// `StandardBom.updateComponents()`'s doc comment) and reuses
// `RegisterStandardBomComponentDto` verbatim — there is no id-optional
// "new vs. reused" variant the way `products`' edit input needs one, since
// this module never creates a new `Component`/`Material` master row. No
// scenario in the feature exercises editing `active`, but it's included here
// for parity with the register shape; `EditStandardBomCommand.active` stays
// optional with no "must be explicit" rule the way registration has one.
export class UpdateStandardBomDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @ApiPropertyOptional({ example: '5678' })
  miCode?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @ApiPropertyOptional({ example: 'Schneider' })
  brand?: string;

  // `@IsOptional()` treats a missing key *and* an explicit `null` as "skip
  // validation" alike, which would let `standardLength: null` — the wire
  // shape a cleared `type="number"` edit-form input sends, see this module's
  // CLAUDE.md — slip through untouched. `EditStandardBomCommand`'s ternary
  // (`body.standardLength === undefined ? undefined : StandardLength.of(...)`)
  // would then call `StandardLength.of(null)` directly: a value object built
  // from unvalidated request data, which throws a plain `Error` no
  // `ExceptionMapper` matches and surfaces as a 500 (see
  // src/framework/CLAUDE.md's note on `ValueObject`). `@ValidateIf` only
  // skips validation when the key is missing entirely (`undefined`, "leave
  // unchanged" — see `EditStandardBomCommand`'s doc comment); an explicit
  // `null` still runs `@IsNumber()`/`@IsPositive()` and is rejected as an
  // ordinary 400 validation error, the same "standard length cannot be
  // empty" rule the register path already enforces.
  @ValidateIf((dto: UpdateStandardBomDto) => dto.standardLength !== undefined)
  @IsNumber()
  @IsPositive()
  @ApiPropertyOptional({ example: 500 })
  standardLength?: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Updated description' })
  description?: string;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ example: false })
  active?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RegisterStandardBomComponentDto)
  @ApiPropertyOptional({
    type: RegisterStandardBomComponentDto,
    isArray: true,
  })
  components?: RegisterStandardBomComponentDto[];
}
