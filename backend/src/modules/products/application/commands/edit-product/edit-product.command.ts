import { Identity } from '@framework/domain';
import { ProductName } from '@products/domain/value/product-name.vo';

import { EditProductComponentInput } from '../product-component.input';

export class EditProductCommand {
  constructor(
    public readonly productId: Identity,
    public readonly name?: ProductName,
    public readonly components?: EditProductComponentInput[],
  ) {}
}
