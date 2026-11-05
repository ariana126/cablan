import { DomainException } from '@framework/domain';

// An order holds a standard BOM at most once: the same MI code twice in a
// definition or an edit, or added again to an order that has it.
export class OrderMiCodeAlreadyAssigned extends DomainException {
  private constructor(
    message: string,
    public readonly miCode: string,
  ) {
    super(message);
  }

  public static withMiCode(miCode: string): OrderMiCodeAlreadyAssigned {
    return new OrderMiCodeAlreadyAssigned(
      `MI code ${miCode} is already assigned to the order`,
      miCode,
    );
  }
}
