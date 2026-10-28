import { DomainException } from '@framework/domain';

// Thrown by `Bom.edit()` when an edit that really changes something comes
// with a missing, empty or whitespace-only reason: every effective edit says
// why. Checked before the BOM is touched, so a refused edit changes nothing.
export class EditReasonRequired extends DomainException {
  private constructor(message: string) {
    super(message);
  }

  public static create(): EditReasonRequired {
    return new EditReasonRequired(
      'A daily BOM cannot be edited without a reason',
    );
  }
}
