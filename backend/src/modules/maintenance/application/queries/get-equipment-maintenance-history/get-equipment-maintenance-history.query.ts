import { Identity } from '@framework/domain';
import { CalendarDateRange } from '@maintenance/domain/value/calendar-date-range.vo';

export class GetEquipmentMaintenanceHistoryQuery {
  constructor(
    public readonly equipmentId: Identity,
    /**
     * Only the entries whose history date is in it — a job's Tehran
     * performed day, a missed occurrence's due date — or every entry when
     * `null`.
     */
    public readonly range: CalendarDateRange | null = null,
  ) {}
}
