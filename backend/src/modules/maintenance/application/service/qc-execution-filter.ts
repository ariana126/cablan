import { Identity, toAsciiDigits } from '@framework/domain';
import { InvalidQcExecutionRange } from '@maintenance/application/exceptions/invalid-qc-execution-range.exception';

/** The QC records' filters as asked for, each optional. */
export interface QcExecutionCriteria {
  readonly from: Date | null;
  readonly to: Date | null;
  readonly equipmentId: Identity | null;
  readonly activityId: Identity | null;
  readonly performedById: Identity | null;
  readonly trackingNumber: string | null;
}

/**
 * Which QC records a read covers (issue #119), every filter combinable and
 * each `null` when not asked for: performed within `[from, to]` (both
 * inclusive), on one piece of equipment, of one activity, by one performer,
 * and with a tracking number containing `trackingNumber` — case-insensitive,
 * searched trimmed and with Persian-keyboard digits as English ones, the
 * way tracking numbers are stored. It narrows the records read, never what
 * their intervals are measured from.
 */
export class QcExecutionFilter implements QcExecutionCriteria {
  private constructor(
    public readonly from: Date | null,
    public readonly to: Date | null,
    public readonly equipmentId: Identity | null,
    public readonly activityId: Identity | null,
    public readonly performedById: Identity | null,
    public readonly trackingNumber: string | null,
  ) {}

  public static of(criteria: QcExecutionCriteria): QcExecutionFilter {
    if (criteria.from && criteria.to && criteria.from > criteria.to) {
      throw InvalidQcExecutionRange.startingAfterEnd(
        criteria.from,
        criteria.to,
      );
    }
    const trackingNumber = criteria.trackingNumber?.trim() ?? '';
    return new QcExecutionFilter(
      criteria.from,
      criteria.to,
      criteria.equipmentId,
      criteria.activityId,
      criteria.performedById,
      trackingNumber ? toAsciiDigits(trackingNumber) : null,
    );
  }
}
