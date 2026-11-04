import { ApplyToRelatedRecords } from '@framework/application';
import { Identity } from '@framework/domain';
import { ProductName } from '@products/domain/value/product-name.vo';

import { EditProductComponentInput } from '../product-component.input';

export class EditProductCommand {
  constructor(
    public readonly productId: Identity,
    public readonly name?: ProductName,
    public readonly components?: EditProductComponentInput[],
    /** Issue #110: the System Admin's correction of a product in use — its name only. */
    public readonly applyToRelatedRecords: ApplyToRelatedRecords = ApplyToRelatedRecords.notAsked(),
  ) {}
}
