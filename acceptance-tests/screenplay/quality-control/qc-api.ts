import { Ensure, equals } from '@serenity-js/assertions';
import { GetRequest, LastResponse, Send } from '@serenity-js/rest';
import { tehranWallClockInstant } from '../common/jalali-datetime';
import { ApiReader } from '../maintenance-management/maintenance-api';

/**
 * Production QC's HTTP contract (issue #119), as `docs/superpowers/plans/2026-11-16-production-qc.md`
 * pins it — the read models and the reads a domain `Interaction` performs as whichever actor it runs
 * as. Instants are ISO-8601; the Gherkin writes them as Tehran wall-clock «1405/07/01 08:00».
 */

/** One row of `GET qc-activities`, by name. */
export interface QcActivityReadModel {
  id: string;
  name: string;
  assignedEquipmentCount: number;
}

/** An activity assigned to an equipment, with its last execution there — over every record, ever. */
export interface QcActivityStatusReadModel {
  activityId: string;
  activityName: string;
  lastPerformedAt: string | null;
}

/** `GET qc-equipment/:equipmentId` and `GET qc-inspections/:equipmentId`. */
export interface QcEquipmentReadModel {
  id: string;
  name: string;
  retired: boolean;
  /** The activities currently assigned, by name. */
  activities: QcActivityStatusReadModel[];
}

/** One record of `GET qc-executions`, newest first. Names are the **current** ones. */
export interface QcExecutionReadModel {
  id: string;
  equipmentId: string;
  equipmentName: string;
  activityId: string;
  activityName: string;
  performedById: string;
  performedByName: string;
  performedAt: string;
  trackingNumber: string;
  notes: string | null;
  /** The previous record of the same equipment and activity over **all** records — never the filtered set. */
  previousPerformedAt: string | null;
  /** Whole minutes since it, floored; null for the first record of the pair. */
  intervalMinutes: number | null;
}

/** Records per equipment and activity, over the filtered records. */
export interface QcExecutionCountReadModel {
  equipmentId: string;
  equipmentName: string;
  activityId: string;
  activityName: string;
  count: number;
}

export interface QcExecutionHistoryReadModel {
  executions: QcExecutionReadModel[];
  counts: QcExecutionCountReadModel[];
}

/** A Tehran wall-clock minute as the Gherkin writes it — `"1405/07/01 08:00"`. */
export interface QcInstant {
  date: string;
  time: string;
}

/** «1405/07/01 08:00» → its date and time. */
export const qcInstantFrom = (text: string): QcInstant => {
  const [date, time] = text.trim().split(/\s+/);
  if (!date || !time) {
    throw new Error(`"${text}" is not a «YYYY/MM/DD HH:mm» instant.`);
  }
  return { date, time };
};

/**
 * The filters `GET qc-executions` takes and the Gherkin names: a range of Tehran wall-clock minutes
 * (both bounds inclusive) and a tracking number. Absent means unfiltered.
 */
export interface QcExecutionFilters {
  from?: QcInstant;
  to?: QcInstant;
  equipmentId?: string;
  trackingNumber?: string;
}

const isoInstantOf = ({ date, time }: QcInstant): string =>
  tehranWallClockInstant(date, time).toISOString();

/** `qc-executions?from=…&to=…&equipmentId=…&trackingNumber=…`, leaving out what is not filtered. */
export const qcExecutionsResource = (
  filters: QcExecutionFilters = {},
): string => {
  const query = new URLSearchParams();
  if (filters.from) {
    query.set('from', isoInstantOf(filters.from));
  }
  if (filters.to) {
    query.set('to', isoInstantOf(filters.to));
  }
  if (filters.equipmentId) {
    query.set('equipmentId', filters.equipmentId);
  }
  if (filters.trackingNumber !== undefined) {
    query.set('trackingNumber', filters.trackingNumber);
  }
  const search = query.toString();
  return search === '' ? 'qc-executions' : `qc-executions?${search}`;
};

/**
 * The interval since the previous record as the business writes it: the non-zero parts of days,
 * hours and minutes joined by « و » — «1 روز و 3 ساعت و 20 دقیقه», «2 ساعت»; «0 دقیقه» for none
 * at all, «بدون سابقه قبلی» for the first record. The frontend renders `intervalMinutes` the same
 * way (the design's "UI" section); the suite reads the API, so it writes the label itself.
 */
export const intervalLabel = (intervalMinutes: number | null): string => {
  if (intervalMinutes === null) {
    return 'بدون سابقه قبلی';
  }
  const days = Math.floor(intervalMinutes / (24 * 60));
  const hours = Math.floor((intervalMinutes % (24 * 60)) / 60);
  const minutes = intervalMinutes % 60;
  const parts = [
    days > 0 ? `${days} روز` : undefined,
    hours > 0 ? `${hours} ساعت` : undefined,
    minutes > 0 ? `${minutes} دقیقه` : undefined,
  ].filter((part): part is string => part !== undefined);
  return parts.length === 0 ? '0 دقیقه' : parts.join(' و ');
};

/** The QR payload printed for an equipment (the design's "QR code" section). */
export const qrPayloadOf = (equipmentId: string): string =>
  `CABLAN-EQ:${equipmentId}`;

/** The equipment id a scanned payload names — what the in-app scanner hands the backend. */
export const equipmentIdInQrPayload = (payload: string): string => {
  const match = /^CABLAN-EQ:(.+)$/.exec(payload.trim());
  if (!match) {
    throw new Error(`"${payload}" is not a Cablan equipment QR payload.`);
  }
  return match[1];
};

const read = async <T>(actor: ApiReader, resource: string): Promise<T> => {
  await Send.a(GetRequest.to(resource)).performAs(actor);
  await Ensure.that(LastResponse.status(), equals(200)).performAs(actor);
  return actor.answer(LastResponse.body<T>());
};

export const readQcActivities = (
  actor: ApiReader,
): Promise<QcActivityReadModel[]> => read(actor, 'qc-activities');

export const readQcEquipment = (
  actor: ApiReader,
  equipmentId: string,
): Promise<QcEquipmentReadModel> => read(actor, `qc-equipment/${equipmentId}`);

export const readQcExecutionHistory = (
  actor: ApiReader,
  filters: QcExecutionFilters = {},
): Promise<QcExecutionHistoryReadModel> =>
  read(actor, qcExecutionsResource(filters));
