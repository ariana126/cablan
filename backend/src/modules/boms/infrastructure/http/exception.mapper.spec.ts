// Loaded first, for its side effect: the framework barrel pulls in
// `HttpExceptionFilter`, which instantiates every module's mapper. Entering that
// cycle from the mapper under test instead leaves `BomsExceptionMapper` still
// undefined when the filter reaches it.
import '@framework/infrastructure';

import {
  BomOrderNotDefined,
  OrderMiCodeNotFound,
  OrderNumberTaken,
} from '@boms/application/exceptions';
import { BomAlreadyReviewed } from '@boms/domain/exceptions/bom-already-reviewed.exception';
import { BomMiCodeNotInOrder } from '@boms/domain/exceptions/bom-mi-code-not-in-order.exception';
import { BomMiCodeRequired } from '@boms/domain/exceptions/bom-mi-code-required.exception';
import { BomNotResamplable } from '@boms/domain/exceptions/bom-not-resamplable.exception';
import { EditReasonRequired } from '@boms/domain/exceptions/edit-reason-required.exception';
import { OrderMiCodeAlreadyAssigned } from '@boms/domain/exceptions/order-mi-code-already-assigned.exception';
import { RejectionReasonRequired } from '@boms/domain/exceptions/rejection-reason-required.exception';
import { ApprovalStatus } from '@boms/domain/value/approval-status';
import { OrderNumber } from '@boms/domain/value/order-number.vo';
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

describe('Problem Details for re-sampling a daily BOM', () => {
  const sut = new BomsExceptionMapper();

  it('maps re-sampling a daily BOM that is not rejected to a 409 carrying its status and the reason', () => {
    const exception = BomNotResamplable.because(
      'not-rejected',
      'bom-1',
      ApprovalStatus.Pending,
    );

    expect(sut.canMap(exception)).toBe(true);
    expect({ ...sut.toProblemDetail(exception) }).toStrictEqual({
      typeUri: 'bom-not-resamplable',
      title: 'BOM Not Resamplable',
      status: HttpStatus.CONFLICT,
      detail:
        'Daily BOM bom-1 cannot be re-sampled: it is pending, not rejected',
      instance: undefined,
      extensionMembers: { approvalStatus: 'pending', reason: 'not-rejected' },
    });
  });

  it('maps re-sampling a rejected daily BOM that is not the latest to a 409 saying so', () => {
    const exception = BomNotResamplable.because(
      'not-latest',
      'bom-1',
      ApprovalStatus.Rejected,
    );

    expect(sut.toProblemDetail(exception).asResponseBody()).toEqual(
      expect.objectContaining({
        status: HttpStatus.CONFLICT,
        approvalStatus: 'rejected',
        reason: 'not-latest',
      }),
    );
  });
});

describe('Problem Details for editing a daily BOM', () => {
  const sut = new BomsExceptionMapper();

  it('maps an edit that changes something without a reason to a 400', () => {
    const exception = EditReasonRequired.create();

    expect(sut.canMap(exception)).toBe(true);
    expect({ ...sut.toProblemDetail(exception) }).toStrictEqual({
      typeUri: 'edit-reason-required',
      title: 'Edit Reason Required',
      status: HttpStatus.BAD_REQUEST,
      detail: 'A daily BOM cannot be edited without a reason',
      instance: undefined,
      extensionMembers: undefined,
    });
  });
});

// Issue #101's pinned problem types.
describe('Problem Details for orders and the daily BOMs registered for them', () => {
  const sut = new BomsExceptionMapper();
  const ORD_5001 = OrderNumber.fromString('ORD-5001');

  it.each([
    [
      OrderNumberTaken.withOrderNumber(ORD_5001),
      'order-number-taken',
      HttpStatus.CONFLICT,
      { orderNumber: 'ORD-5001' },
    ],
    [
      OrderMiCodeNotFound.withMiCode('9999'),
      'order-mi-code-not-found',
      HttpStatus.BAD_REQUEST,
      { miCode: '9999' },
    ],
    [
      OrderMiCodeAlreadyAssigned.withMiCode('1001'),
      'order-mi-code-already-assigned',
      HttpStatus.CONFLICT,
      { miCode: '1001' },
    ],
    [
      BomOrderNotDefined.withOrderNumber(ORD_5001),
      'bom-order-not-defined',
      HttpStatus.BAD_REQUEST,
      { orderNumber: 'ORD-5001' },
    ],
    [
      BomMiCodeRequired.forOrder(ORD_5001),
      'bom-mi-code-required',
      HttpStatus.BAD_REQUEST,
      { orderNumber: 'ORD-5001' },
    ],
    [
      BomMiCodeNotInOrder.of('0003', ORD_5001),
      'bom-mi-code-not-in-order',
      HttpStatus.BAD_REQUEST,
      { orderNumber: 'ORD-5001', standardBomMiCode: '0003' },
    ],
  ] as const)(
    'maps %p to %s',
    (exception, typeUri, status, extensionMembers) => {
      expect(sut.canMap(exception)).toBe(true);
      expect({ ...sut.toProblemDetail(exception) }).toMatchObject({
        typeUri,
        status,
        detail: exception.message,
        extensionMembers,
      });
    },
  );
});
