// Loaded first, for its side effect: the framework barrel pulls in
// `HttpExceptionFilter`, which instantiates every module's mapper. Entering that
// cycle from the mapper under test instead leaves `BomsExceptionMapper` still
// undefined when the filter reaches it.
import '@framework/infrastructure';

import { BomAlreadyReviewed } from '@boms/domain/exceptions/bom-already-reviewed.exception';
import { RejectionReasonRequired } from '@boms/domain/exceptions/rejection-reason-required.exception';
import { ApprovalStatus } from '@boms/domain/value/approval-status';
import { HttpStatus } from '@nestjs/common';

import { BomsExceptionMapper } from './exception.mapper';

// Pins the Problem Details contract of the review's two refusals.
describe('Problem Details for reviewing a daily BOM', () => {
  const sut = new BomsExceptionMapper();

  it('maps reviewing a BOM that is already reviewed to a 409 carrying its status', () => {
    const exception = BomAlreadyReviewed.withStatus(
      'bom-1',
      ApprovalStatus.Approved,
    );

    expect(sut.canMap(exception)).toBe(true);
    expect({ ...sut.toProblemDetail(exception) }).toStrictEqual({
      typeUri: 'bom-already-reviewed',
      title: 'BOM Already Reviewed',
      status: HttpStatus.CONFLICT,
      detail:
        'Daily BOM bom-1 is already approved; edit it to send it back to pending before reviewing it again',
      instance: undefined,
      extensionMembers: { approvalStatus: 'approved' },
    });
  });

  it('maps a rejection without a reason to a 400', () => {
    const exception = RejectionReasonRequired.create();

    expect(sut.canMap(exception)).toBe(true);
    expect({ ...sut.toProblemDetail(exception) }).toStrictEqual({
      typeUri: 'rejection-reason-required',
      title: 'Rejection Reason Required',
      status: HttpStatus.BAD_REQUEST,
      detail: 'A daily BOM cannot be rejected without a reason',
      instance: undefined,
      extensionMembers: undefined,
    });
  });
});
