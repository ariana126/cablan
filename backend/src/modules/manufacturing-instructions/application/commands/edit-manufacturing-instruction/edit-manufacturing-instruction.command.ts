import { Identity } from '@framework/domain';
import { Brand } from '@manufacturing-instructions/domain/value/brand.vo';
import { MiCode } from '@manufacturing-instructions/domain/value/mi-code.vo';
import { StandardLength } from '@manufacturing-instructions/domain/value/standard-length.vo';

import { RegisterManufacturingInstructionComponentInput } from '../manufacturing-instruction-component.input';

// Every field but `manufacturingInstructionId` is optional: `undefined` means "leave
// unchanged", the same convention `EditProductCommand` uses for `name`. The
// referenced product itself is not editable (see `ManufacturingInstruction.edit()`'s doc
// comment), so there is no `productId` here — `components`, when given, is
// still cloned from the standard BOM's *existing* `productId`.
export class EditManufacturingInstructionCommand {
  constructor(
    public readonly manufacturingInstructionId: Identity,
    public readonly miCode?: MiCode,
    public readonly brand?: Brand,
    public readonly standardLength?: StandardLength,
    public readonly description?: string,
    public readonly active?: boolean,
    public readonly components?: RegisterManufacturingInstructionComponentInput[],
  ) {}
}
