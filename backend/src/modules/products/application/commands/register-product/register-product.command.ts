import { ProductName } from '@products/domain/value/product-name.vo';

import { RegisterProductComponentInput } from '../product-component.input';

export class RegisterProductCommand {
  constructor(
    public readonly name: ProductName,
    public readonly components: RegisterProductComponentInput[],
  ) {}
}
