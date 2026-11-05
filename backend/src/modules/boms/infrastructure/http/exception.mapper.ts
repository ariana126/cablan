import {
  BomComponentMustHaveAtLeastOneMaterial,
  BomCompositionEntryNotFound,
  BomMustHaveAtLeastOneComponent,
  BomOrderNotDefined,
  BomStandardBomNotFound,
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
import { ExceptionMapper, ProblemDetail } from '@framework/infrastructure';
import { HttpStatus } from '@nestjs/common';
import { RuntimeException } from '@nestjs/core/errors/exceptions';

export class BomsExceptionMapper implements ExceptionMapper {
  canMap(exception: unknown): boolean {
    return (
      exception instanceof BomMustHaveAtLeastOneComponent ||
      exception instanceof BomComponentMustHaveAtLeastOneMaterial ||
      exception instanceof BomStandardBomNotFound ||
      exception instanceof BomCompositionEntryNotFound ||
      exception instanceof BomAlreadyReviewed ||
      exception instanceof RejectionReasonRequired ||
      exception instanceof BomNotResamplable ||
      exception instanceof EditReasonRequired ||
      exception instanceof OrderNumberTaken ||
      exception instanceof OrderMiCodeNotFound ||
      exception instanceof OrderMiCodeAlreadyAssigned ||
      exception instanceof BomOrderNotDefined ||
      exception instanceof BomMiCodeRequired ||
      exception instanceof BomMiCodeNotInOrder
    );
  }

  toProblemDetail(exception: unknown): ProblemDetail {
    switch (true) {
      case exception instanceof BomMustHaveAtLeastOneComponent: {
        return new ProblemDetail(
          'bom-must-have-at-least-one-component',
          'BOM Must Have At Least One Component',
          HttpStatus.BAD_REQUEST,
          exception.message,
        );
      }

      case exception instanceof BomComponentMustHaveAtLeastOneMaterial: {
        return new ProblemDetail(
          'bom-component-must-have-at-least-one-material',
          'BOM Component Must Have At Least One Material',
          HttpStatus.BAD_REQUEST,
          exception.message,
          undefined,
          { componentId: exception.componentId },
        );
      }

      case exception instanceof BomStandardBomNotFound: {
        return new ProblemDetail(
          'bom-standard-bom-not-found',
          'BOM Standard BOM Not Found',
          HttpStatus.BAD_REQUEST,
          exception.message,
          undefined,
          { standardBomMiCode: exception.standardBomMiCode },
        );
      }

      case exception instanceof BomCompositionEntryNotFound: {
        return new ProblemDetail(
          'bom-composition-entry-not-found',
          'BOM Composition Entry Not Found',
          HttpStatus.BAD_REQUEST,
          exception.message,
          undefined,
          { entryId: exception.entryId },
        );
      }

      // Approving or rejecting a BOM that is already approved or rejected: a
      // conflict with its current state, which only an edit resolves.
      case exception instanceof BomAlreadyReviewed: {
        return new ProblemDetail(
          'bom-already-reviewed',
          'BOM Already Reviewed',
          HttpStatus.CONFLICT,
          exception.message,
          undefined,
          { approvalStatus: exception.approvalStatus },
        );
      }

      case exception instanceof RejectionReasonRequired: {
        return new ProblemDetail(
          'rejection-reason-required',
          'Rejection Reason Required',
          HttpStatus.BAD_REQUEST,
          exception.message,
        );
      }

      // An edit that changes something must say why; nothing was changed.
      case exception instanceof EditReasonRequired: {
        return new ProblemDetail(
          'edit-reason-required',
          'Edit Reason Required',
          HttpStatus.BAD_REQUEST,
          exception.message,
        );
      }

      // Re-sampling a daily BOM that is not rejected, or not the latest of its
      // tracking number: a conflict with the current state, like a review of
      // an already reviewed BOM.
      case exception instanceof BomNotResamplable: {
        return new ProblemDetail(
          'bom-not-resamplable',
          'BOM Not Resamplable',
          HttpStatus.CONFLICT,
          exception.message,
          undefined,
          {
            approvalStatus: exception.approvalStatus,
            reason: exception.reason,
          },
        );
      }

      // Orders (issue #101): a number another order has, and an MI code
      // assigned twice, conflict with what is stored; an MI code naming no
      // standard BOM is a defect in the request.
      case exception instanceof OrderNumberTaken: {
        return new ProblemDetail(
          'order-number-taken',
          'Order Number Taken',
          HttpStatus.CONFLICT,
          exception.message,
          undefined,
          { orderNumber: exception.orderNumber },
        );
      }

      case exception instanceof OrderMiCodeNotFound: {
        return new ProblemDetail(
          'order-mi-code-not-found',
          'Order MI Code Not Found',
          HttpStatus.BAD_REQUEST,
          exception.message,
          undefined,
          { miCode: exception.miCode },
        );
      }

      case exception instanceof OrderMiCodeAlreadyAssigned: {
        return new ProblemDetail(
          'order-mi-code-already-assigned',
          'Order MI Code Already Assigned',
          HttpStatus.CONFLICT,
          exception.message,
          undefined,
          { miCode: exception.miCode },
        );
      }

      // A daily BOM's order and MI code, registered or edited (issue #101).
      case exception instanceof BomOrderNotDefined: {
        return new ProblemDetail(
          'bom-order-not-defined',
          'BOM Order Not Defined',
          HttpStatus.BAD_REQUEST,
          exception.message,
          undefined,
          { orderNumber: exception.orderNumber },
        );
      }

      case exception instanceof BomMiCodeRequired: {
        return new ProblemDetail(
          'bom-mi-code-required',
          'BOM MI Code Required',
          HttpStatus.BAD_REQUEST,
          exception.message,
          undefined,
          { orderNumber: exception.orderNumber },
        );
      }

      case exception instanceof BomMiCodeNotInOrder: {
        return new ProblemDetail(
          'bom-mi-code-not-in-order',
          'BOM MI Code Not In Order',
          HttpStatus.BAD_REQUEST,
          exception.message,
          undefined,
          {
            orderNumber: exception.orderNumber,
            standardBomMiCode: exception.standardBomMiCode,
          },
        );
      }

      default: {
        throw new RuntimeException(
          `Unexpected exception type: ${String(exception)}`,
        );
      }
    }
  }
}
