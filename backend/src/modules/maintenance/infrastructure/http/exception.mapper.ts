import { ExceptionMapper, ProblemDetail } from '@framework/infrastructure';
import {
  EquipmentNameTaken,
  MaintenanceActivityNameTaken,
} from '@maintenance/application/exceptions';
import { ActivityAlreadyInPmPlan } from '@maintenance/domain/exceptions/activity-already-in-pm-plan.exception';
import { EquipmentIsRetired } from '@maintenance/domain/exceptions/equipment-is-retired.exception';
import { PmOccurrenceAlreadyRecorded } from '@maintenance/domain/exceptions/pm-occurrence-already-recorded.exception';
import { PmPlanItemIsRemoved } from '@maintenance/domain/exceptions/pm-plan-item-is-removed.exception';
import { UsageBasedIntervalNotSupported } from '@maintenance/domain/exceptions/usage-based-interval-not-supported.exception';
import { HttpStatus } from '@nestjs/common';

/**
 * The maintenance module's problems. Each `detail` is the Persian sentence a
 * user reads in the form; the extension members carry what a client needs to
 * point at the offending record. A conflict with existing state is a 409;
 * an interval in operating hours is the request's own fault, a 400.
 */
export class MaintenanceExceptionMapper implements ExceptionMapper {
  canMap(exception: unknown): boolean {
    return (
      exception instanceof EquipmentNameTaken ||
      exception instanceof MaintenanceActivityNameTaken ||
      exception instanceof ActivityAlreadyInPmPlan ||
      exception instanceof UsageBasedIntervalNotSupported ||
      exception instanceof EquipmentIsRetired ||
      exception instanceof PmPlanItemIsRemoved ||
      exception instanceof PmOccurrenceAlreadyRecorded
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
        return conflict(
          'equipment-retired',
          'Equipment Retired',
          'این تجهیز کنار گذاشته شده است',
          { equipmentId: exception.equipmentId },
        );
      }

      case exception instanceof PmPlanItemIsRemoved: {
        return conflict(
          'pm-plan-item-removed',
          'PM Plan Item Removed',
          'این فعالیت از برنامه تجهیز حذف شده است',
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
