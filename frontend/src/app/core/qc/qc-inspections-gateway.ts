import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { QcEquipmentControllerRecordSeveral200ResultsItemProblemType } from '../../api/model';
import { QcEquipmentService } from '../../api/qc-equipment/qc-equipment.service';
import { QcInspectionsService } from '../../api/qc-inspections/qc-inspections.service';
import { AppQcEquipment, toAppQcEquipment } from './qc-equipment-gateway';

/** One ticked activity of a submission, with the notes written beside it. */
export interface QcActivityToRecord {
  readonly activityId: string;
  /** Optional; blank is left out. */
  readonly notes: string;
}

/**
 * What «ثبت انجام» sends for one equipment (issue #132): who and when come from the token and the
 * API's clock, never from here.
 */
export interface QcSubmission {
  /** Drawn by the client once per submission, and sent again unchanged on «ارسال دوباره». */
  readonly submissionId: string;
  /** Required, any text, one for every activity; the API refuses a blank one. */
  readonly trackingNumber: string;
  /** In the order they are listed, each once. */
  readonly activities: readonly QcActivityToRecord[];
}

/** Why one activity of a submission was refused, `null` when it was recorded. */
export type QcActivityRefusal = QcEquipmentControllerRecordSeveral200ResultsItemProblemType;

/** How one activity of a submission fared — recorded, or refused on its own. */
export interface AppQcSubmissionResult {
  readonly activityId: string;
  /** Its current name; `null` when no QC activity has the id. */
  readonly activityName: string | null;
  readonly outcome: 'recorded' | 'refused';
  /** Set when recorded — now, or by an earlier sending of the same submission. */
  readonly executionId: string | null;
  /** Set when refused. */
  readonly problemType: QcActivityRefusal;
}

/**
 * The in-production inspection (issue #119) — the QC inspector, Management and the System Admin: the
 * equipment a QR code names, its assigned activities with their last execution, and recording the
 * ticked ones as done (issue #132).
 */
@Injectable({ providedIn: 'root' })
export class QcInspectionsGateway {
  private readonly inspections = inject(QcInspectionsService);
  private readonly equipment = inject(QcEquipmentService);

  /** In-service equipment with at least one assigned activity, by name. */
  list(): Observable<AppQcEquipment[]> {
    return this.inspections
      .qcInspectionControllerList()
      .pipe(map((items) => items.map(toAppQcEquipment)));
  }

  /** Any equipment by id — retired included (`retired: true`), unknown a 404. */
  get(equipmentId: string): Observable<AppQcEquipment> {
    return this.inspections.qcInspectionControllerGet(equipmentId).pipe(map(toAppQcEquipment));
  }

  /**
   * Records every ticked activity with one tracking number (issue #132). Each is recorded or refused
   * on its own, and the answer lists them in the order sent. Sending the same `submissionId` again
   * never records an activity twice.
   */
  recordTogether(
    equipmentId: string,
    submission: QcSubmission,
  ): Observable<AppQcSubmissionResult[]> {
    return this.equipment
      .qcEquipmentControllerRecordSeveral(equipmentId, {
        submissionId: submission.submissionId,
        trackingNumber: submission.trackingNumber,
        activities: submission.activities.map(({ activityId, notes }) =>
          notes.trim() === '' ? { activityId } : { activityId, notes },
        ),
      })
      .pipe(
        map(({ results }) =>
          results.map((result) => ({
            activityId: result.activityId,
            activityName: result.activityName,
            outcome: result.outcome,
            executionId: result.executionId,
            problemType: result.problemType,
          })),
        ),
      );
  }
}
