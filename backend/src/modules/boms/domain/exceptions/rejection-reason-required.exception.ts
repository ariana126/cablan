import { DomainException } from '@framework/domain';

// Thrown by `Bom.reject()` when the reason is missing, empty or only
// whitespace: a rejection always says why.
export class RejectionReasonRequired extends DomainException {
  private constructor(message: string) {
    super(message);
  }

  public static create(): RejectionReasonRequired {
    return new RejectionReasonRequired(
      'A daily BOM cannot be rejected without a reason',
    );
  }
}
