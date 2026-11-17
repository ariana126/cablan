import { ExceptionMapper, ProblemDetail } from '@framework/infrastructure';
import {
  EquipmentChangedConcurrently,
  EquipmentNameTaken,
  EquipmentNotFound,
  InvalidPmScheduleRange,
  InvalidQcExecutionRange,
  MaintenanceActivityNameTaken,
  QcActivityNameTaken,
  QcActivityNotFound,
  QcExecutionNotFound,
} from '@maintenance/application/exceptions';
import { ActivityAlreadyHasSpecialty } from '@maintenance/domain/exceptions/activity-already-has-specialty.exception';
import { ActivityAlreadyInPmPlan } from '@maintenance/domain/exceptions/activity-already-in-pm-plan.exception';
import { DateRangeStartsAfterEnd } from '@maintenance/domain/exceptions/date-range-starts-after-end.exception';
import { EquipmentIsRetired } from '@maintenance/domain/exceptions/equipment-is-retired.exception';
import { EquipmentNotRetired } from '@maintenance/domain/exceptions/equipment-not-retired.exception';
import { InvalidReactivationItem } from '@maintenance/domain/exceptions/invalid-reactivation-item.exception';
import { PmOccurrenceAlreadyRecorded } from '@maintenance/domain/exceptions/pm-occurrence-already-recorded.exception';
import { PmPlanItemIsActive } from '@maintenance/domain/exceptions/pm-plan-item-is-active.exception';
import { PmPlanItemIsDeactivated } from '@maintenance/domain/exceptions/pm-plan-item-is-deactivated.exception';
import { QcActivityAlreadyAssigned } from '@maintenance/domain/exceptions/qc-activity-already-assigned.exception';
import { QcActivityNotAssigned } from '@maintenance/domain/exceptions/qc-activity-not-assigned.exception';
import { ReactivationFirstDueDateInPast } from '@maintenance/domain/exceptions/reactivation-first-due-date-in-past.exception';
import { SpecialtyAssignmentMismatch } from '@maintenance/domain/exceptions/specialty-assignment-mismatch.exception';
import { UsageBasedIntervalNotSupported } from '@maintenance/domain/exceptions/usage-based-interval-not-supported.exception';
import { HttpStatus } from '@nestjs/common';

/**
 * The maintenance module's problems. Each `detail` is the Persian sentence a
 * user reads in the form; the extension members carry what a client needs to
 * point at the offending record. A conflict with existing state is a 409;
 * an interval in operating hours, a PM schedule range without both bounds or
 * starting after it ends, an equipment history range starting after it ends
 * (a `validation-error`), or a specialty assignment not naming exactly the
 * activities without one, is the request's own fault, a 400.
 */
export class MaintenanceExceptionMapper implements ExceptionMapper {
  canMap(exception: unknown): boolean {
    return (
      exception instanceof EquipmentNameTaken ||
      exception instanceof MaintenanceActivityNameTaken ||
      exception instanceof ActivityAlreadyInPmPlan ||
      exception instanceof UsageBasedIntervalNotSupported ||
      exception instanceof EquipmentIsRetired ||
      exception instanceof PmPlanItemIsDeactivated ||
      exception instanceof PmOccurrenceAlreadyRecorded ||
      exception instanceof EquipmentChangedConcurrently ||
      exception instanceof InvalidPmScheduleRange ||
      exception instanceof DateRangeStartsAfterEnd ||
      exception instanceof SpecialtyAssignmentMismatch ||
      exception instanceof ActivityAlreadyHasSpecialty ||
      exception instanceof PmPlanItemIsActive ||
      exception instanceof EquipmentNotRetired ||
      exception instanceof InvalidReactivationItem ||
      exception instanceof ReactivationFirstDueDateInPast ||
      exception instanceof QcActivityNameTaken ||
      exception instanceof QcActivityNotFound ||
      exception instanceof QcExecutionNotFound ||
      exception instanceof EquipmentNotFound ||
      exception instanceof QcActivityAlreadyAssigned ||
      exception instanceof QcActivityNotAssigned ||
      exception instanceof InvalidQcExecutionRange
    );
  }

  toProblemDetail(exception: unknown): ProblemDetail {
    switch (true) {
      case exception instanceof EquipmentNameTaken: {
        return conflict(
          'equipment-name-taken',
          'Equipment Name Taken',
          'تجهیزی با این نام قبلا ثبت شده است',
          { name: exception.equipmentName.asString() },
        );
      }

      case exception instanceof MaintenanceActivityNameTaken: {
        return conflict(
          'maintenance-activity-name-taken',
          'Maintenance Activity Name Taken',
          'فعالیتی با این نام قبلا ثبت شده است',
          { name: exception.activityName.asString() },
        );
      }

      case exception instanceof ActivityAlreadyInPmPlan: {
        return conflict(
          'activity-already-in-pm-plan',
          'Activity Already In PM Plan',
          'این فعالیت قبلا به برنامه این تجهیز اضافه شده است',
          {
            equipmentId: exception.equipmentId,
            activityId: exception.activityId,
          },
        );
      }

      case exception instanceof UsageBasedIntervalNotSupported: {
        return new ProblemDetail(
          'usage-based-interval-not-supported',
          'Usage-Based Interval Not Supported',
          HttpStatus.BAD_REQUEST,
          'برنامه فقط بر اساس روز قابل تعریف است',
          undefined,
          { intervalUnit: exception.intervalUnit },
        );
      }

      case exception instanceof EquipmentIsRetired: {
        // Named when the thrower knew the name (issue #119's QC refusals,
        // and every refusal by the aggregate since).
        return conflict(
          'equipment-retired',
          'Equipment Retired',
          exception.equipmentName === null
            ? 'این تجهیز کنار گذاشته شده است'
            : `"${exception.equipmentName}" کنار گذاشته شده است.`,
          { equipmentId: exception.equipmentId },
        );
      }

      case exception instanceof PmPlanItemIsDeactivated: {
        return conflict(
          'pm-plan-item-deactivated',
          'PM Plan Item Deactivated',
          'این فعالیت در برنامهٔ تجهیز غیرفعال شده است.',
          { planItemId: exception.planItemId },
        );
      }

      case exception instanceof PmOccurrenceAlreadyRecorded: {
        return conflict(
          'pm-occurrence-already-recorded',
          'PM Occurrence Already Recorded',
          'انجام این موعد قبلا ثبت شده است',
          { planItemId: exception.planItemId, dueDate: exception.dueDate },
        );
      }

      case exception instanceof InvalidPmScheduleRange: {
        return new ProblemDetail(
          'invalid-pm-schedule-range',
          'Invalid PM Schedule Range',
          HttpStatus.BAD_REQUEST,
          exception.reason === 'too-long'
            ? 'بازه تاریخ نمی تواند بیشتر از ده سال باشد.'
            : 'بازه تاریخ باید تاریخ شروع و پایان داشته باشد و تاریخ شروع بعد از تاریخ پایان نباشد.',
        );
      }

      // Only the equipment history's `from`/`to` let it through (issue
      // #114) — the PM schedule's finder turns it into
      // `InvalidPmScheduleRange` first — so it reads as the request's
      // validation error on its start, the shape the validation pipe gives.
      case exception instanceof DateRangeStartsAfterEnd: {
        return new ProblemDetail(
          'validation-error',
          'Validation Error',
          HttpStatus.BAD_REQUEST,
          'One or more fields failed validation.',
          undefined,
          {
            errors: [
              {
                field: 'from',
                message: `from must not be after to (${exception.from} – ${exception.to})`,
              },
            ],
          },
        );
      }

      case exception instanceof EquipmentChangedConcurrently: {
        return conflict(
          'equipment-changed-concurrently',
          'Equipment Changed Concurrently',
          'این تجهیز همزمان تغییر کرده است، دوباره تلاش کنید',
          { equipmentId: exception.equipmentId },
        );
      }

      case exception instanceof SpecialtyAssignmentMismatch: {
        return new ProblemDetail(
          'specialty-assignment-incomplete',
          'Specialty Assignment Incomplete',
          HttpStatus.BAD_REQUEST,
          'تخصص همه فعالیت ها باید تعیین شود.',
          undefined,
          {
            missingActivityIds: exception.missingActivityIds,
            unexpectedActivityIds: exception.unexpectedActivityIds,
          },
        );
      }

      // Normally unreachable: `MissingSpecialties` refuses the request as a
      // mismatch first. Should it surface, the activity's state is what
      // conflicts with the request.
      case exception instanceof ActivityAlreadyHasSpecialty: {
        return conflict(
          'activity-already-has-specialty',
          'Activity Already Has Specialty',
          'تخصص این فعالیت قبلا تعیین شده است.',
          { activityId: exception.activityId },
        );
      }

      // Issue #110: the System Admin's deletions and reactivation.
      case exception instanceof PmPlanItemIsActive: {
        return conflict(
          'pm-plan-item-active',
          'PM Plan Item Active',
          'برای حذف ردیف فعال، ابتدا آن را غیرفعال کنید.',
          { planItemId: exception.planItemId },
        );
      }

      case exception instanceof EquipmentNotRetired: {
        return conflict(
          'equipment-not-retired',
          'Equipment Not Retired',
          'فقط تجهیز کنار گذاشته شده قابل حذف یا فعال سازی دوباره است.',
          { equipmentId: exception.equipmentId },
        );
      }

      case exception instanceof InvalidReactivationItem: {
        return new ProblemDetail(
          'invalid-reactivation-item',
          'Invalid Reactivation Item',
          HttpStatus.BAD_REQUEST,
          'ردیف انتخاب شده در برنامه فعال این تجهیز نیست.',
          undefined,
          { planItemId: exception.planItemId },
        );
      }

      case exception instanceof ReactivationFirstDueDateInPast: {
        return new ProblemDetail(
          'reactivation-first-due-date-in-past',
          'Reactivation First Due Date In Past',
          HttpStatus.BAD_REQUEST,
          'اولین موعد تازه نمی تواند پیش از روز فعال سازی باشد.',
          undefined,
          {
            planItemId: exception.planItemId,
            firstDueDate: exception.firstDueDate,
          },
        );
      }

      // Production QC (issue #119).
      case exception instanceof QcActivityNameTaken: {
        return conflict(
          'qc-activity-name-taken',
          'QC Activity Name Taken',
          'فعالیت QC با این عنوان قبلا تعریف شده است.',
          { name: exception.activityName.asString() },
        );
      }

      case exception instanceof QcActivityNotFound: {
        return notFound(
          'qc-activity-not-found',
          'QC Activity Not Found',
          'فعالیت QC پیدا نشد.',
          { activityId: exception.activityId },
        );
      }

      case exception instanceof QcExecutionNotFound: {
        return notFound(
          'qc-execution-not-found',
          'QC Execution Not Found',
          'سابقه انجام QC پیدا نشد.',
          { executionId: exception.executionId },
        );
      }

      case exception instanceof EquipmentNotFound: {
        return notFound(
          'equipment-not-found',
          'Equipment Not Found',
          'تجهیز پیدا نشد.',
          { equipmentId: exception.equipmentId },
        );
      }

      case exception instanceof QcActivityAlreadyAssigned: {
        return conflict(
          'qc-activity-already-assigned',
          'QC Activity Already Assigned',
          `"${exception.activityName}" قبلا به "${exception.equipmentName}" تخصیص داده شده است.`,
          {
            equipmentId: exception.equipmentId,
            activityId: exception.activityId,
          },
        );
      }

      // Unassigning an activity the equipment does not have: there is no
      // such assignment (404). Recording it: the activity exists, but the
      // equipment does not take it (409).
      case exception instanceof QcActivityNotAssigned: {
        return new ProblemDetail(
          'qc-activity-not-assigned',
          'QC Activity Not Assigned',
          exception.attempt === 'unassign'
            ? HttpStatus.NOT_FOUND
            : HttpStatus.CONFLICT,
          `"${exception.activityName}" به "${exception.equipmentName}" تخصیص داده نشده است.`,
          undefined,
          {
            equipmentId: exception.equipmentId,
            activityId: exception.activityId,
          },
        );
      }

      // The QC records' `from` after their `to`: the request's validation
      // error on its start, the shape the validation pipe gives.
      case exception instanceof InvalidQcExecutionRange: {
        return new ProblemDetail(
          'validation-error',
          'Validation Error',
          HttpStatus.BAD_REQUEST,
          'One or more fields failed validation.',
          undefined,
          {
            errors: [
              {
                field: 'from',
                message: `from must not be after to (${exception.from.toISOString()} – ${exception.to.toISOString()})`,
              },
            ],
          },
        );
      }

      default: {
        throw new Error('MaintenanceExceptionMapper cannot map this exception');
      }
    }
  }
}

function conflict(
  type: string,
  title: string,
  detail: string,
  members: Record<string, string>,
): ProblemDetail {
  return new ProblemDetail(
    type,
    title,
    HttpStatus.CONFLICT,
    detail,
    undefined,
    members,
  );
}

function notFound(
  type: string,
  title: string,
  detail: string,
  members: Record<string, string>,
): ProblemDetail {
  return new ProblemDetail(
    type,
    title,
    HttpStatus.NOT_FOUND,
    detail,
    undefined,
    members,
  );
}
