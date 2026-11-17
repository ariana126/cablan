import { ApplicationException } from '@framework/application';

// The QC records asked for from an instant after the one they are asked
// until. A 400 `validation-error` on `from`, like any other malformed filter.
export class InvalidQcExecutionRange extends ApplicationException {
  private constructor(
    message: string,
    public readonly from: Date,
    public readonly to: Date,
  ) {
    super(message);
  }

  public static startingAfterEnd(
    from: Date,
    to: Date,
  ): InvalidQcExecutionRange {
    return new InvalidQcExecutionRange(
      `QC records cannot be read from ${from.toISOString()} to ${to.toISOString()}: it starts after it ends`,
      from,
      to,
    );
  }
}
