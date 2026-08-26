import { Identity } from '@framework/domain';
import { Brand } from '@standard-boms/domain/value/brand.vo';
import { MiCode } from '@standard-boms/domain/value/mi-code.vo';
import { StandardLength } from '@standard-boms/domain/value/standard-length.vo';

import { RegisterStandardBomComponentInput } from '../standard-bom-component.input';

// Every field but `standardBomId` is optional: `undefined` means "leave
// unchanged", the same convention `EditProductCommand` uses for `name`. The
// referenced product itself is not editable (see `StandardBom.edit()`'s doc
// comment), so there is no `productId` here — `components`, when given, is
// still cloned from the standard BOM's *existing* `productId`.
export class EditStandardBomCommand {
  constructor(
    public readonly standardBomId: Identity,
    public readonly miCode?: MiCode,
    public readonly brand?: Brand,
    public readonly standardLength?: StandardLength,
    public readonly description?: string,
    public readonly active?: boolean,
    public readonly components?: RegisterStandardBomComponentInput[],
  ) {}
}
