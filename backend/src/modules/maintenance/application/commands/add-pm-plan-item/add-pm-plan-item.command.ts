import { Identity } from '@framework/domain';
import { CalendarDate } from '@maintenance/domain/value/calendar-date.vo';
import { IntervalUnit } from '@maintenance/domain/value/interval-unit';

// The interval travels as the form states it — a value and its unit — so the
// domain, not the controller, is what refuses an interval in operating hours.
export class AddPmPlanItemCommand {
  constructor(
    public readonly equipmentId: Identity,
    public readonly activityId: Identity,
    public readonly intervalValue: number,
    public readonly intervalUnit: IntervalUnit,
    public readonly firstDueDate: CalendarDate,
  ) {}
}
