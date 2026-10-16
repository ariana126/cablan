import { Identity } from '@framework/domain';
import { Brand } from '@manufacturing-instructions/domain/value/brand.vo';
import { MiCode } from '@manufacturing-instructions/domain/value/mi-code.vo';
import { StandardLength } from '@manufacturing-instructions/domain/value/standard-length.vo';

import { RegisterManufacturingInstructionComponentInput } from '../manufacturing-instruction-component.input';

export class RegisterManufacturingInstructionCommand {
  constructor(
    public readonly productId: Identity,
    public readonly miCode: MiCode,
    public readonly brand: Brand,
    public readonly standardLength: StandardLength,
    // No default and not optional, deliberately: a request that omits
    // whether the standard BOM is active must be rejected rather than
    // silently defaulting, distinctly from a request that explicitly sends
    // `false`. Enforced at the HTTP boundary (the next layer) by a
    // `class-validator` `@IsBoolean()` with no `@IsOptional()`; this
    // command's required constructor argument is what that boundary must
    // supply.
    public readonly active: boolean,
    public readonly description: string | undefined,
    public readonly components: RegisterManufacturingInstructionComponentInput[],
  ) {}
}
