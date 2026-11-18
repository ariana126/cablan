import { d, Interaction, Question, Task } from '@serenity-js/core';
import { WaitUntil } from '../common/polling';
import {
  Ensure,
  equals,
  isGreaterThan,
  isPresent,
  not,
} from '@serenity-js/assertions';
import { GetRequest, LastResponse, Send } from '@serenity-js/rest';
import { tehranJalaliDateTimeOf } from '../common/jalali-datetime';
import { readAsTheSystemAdmin } from '../common/observer';
import {
  ListRow,
  onlyTheColumnsOf,
  TheRowsOf,
} from '../maintenance-management/maintenance-pages';
import { QcInspectionPage } from '../ui/qc-inspection-page';
import {
  equipmentIdInQrPayload,
  QcEquipmentReadModel,
  QcInstant,
  qrPayloadOf,
  readQcEquipment,
} from './qc-api';
import { LocateQcInspectionPage } from './qc-pages';
import { rememberThePrintedQr, theEquipmentIdNamed } from './qc-records';

/**
 * The inspector's side of QC — recording-qc-execution.feature's last executions and its QR rule.
 *
 * **The QR code.** Its payload is the plain text `CABLAN-EQ:<equipment uuid>` (the design's "QR
 * code" section); the PDF «دانلود QR تجهیز» produces on `/equipment` and the camera scanner on
 * `/qc-inspection` are both frontend-only adapters around it, and the backend only ever sees the
 * equipment id. So "printing" a QR here means taking down the payload of the equipment as it is
 * then, and "scanning" it means asking `GET qc-inspections/:equipmentId` for the id it names — what
 * the scanner does once it has decoded the image. ASSUMPTION: the PDF carries exactly that payload;
 * the suite neither downloads the PDF nor decodes its image.
 *
 * **Last executions.** «… فعالیت های QC تجهیز … را مشاهده می کند» is the inspector looking at
 * `/qc-inspection`, where every in-service equipment's activities are listed with their last
 * execution — the one UI door of the inspection page; «آخرین انجام فعالیت های QC تجهیز … به صورت
 * زیر باشد» reads that page. «آخرین انجام «…» روی «…» «…» باشد» reads `GET qc-equipment/:id`.
 */

/** The payload «دانلود QR تجهیز» puts on the equipment's sticker, for its current id. */
const DownloadTheQrOf = (
  equipmentName: string,
  keep: (payload: string) => void,
): Interaction =>
  Interaction.where(
    d`#actor downloads the QR of ${equipmentName}`,
    async (actor) => {
      keep(qrPayloadOf(await theEquipmentIdNamed(actor, equipmentName)));
    },
  );

/** «QR تجهیز «…» چاپ شده باشد». */
export const PrintTheQrOf = (equipmentName: string): Interaction =>
  DownloadTheQrOf(equipmentName, rememberThePrintedQr);

/** «… و QR آن را دوباره دریافت کرده باشد» — a new sticker; the printed one stays on the machine. */
export const DownloadTheQrAgain = (equipmentName: string): Interaction =>
  DownloadTheQrOf(equipmentName, () => undefined);

export const ScanTheQr = {
  /**
   * «… QR چاپ شده قبلی را اسکن می کند» — the scanner decodes the payload and opens the inspection
   * view of the equipment it names. The response is left for the step that judges it.
   */
  viaApiUsing: (payload: string): Task =>
    Task.where(
      d`#actor scans the QR ${payload}`,
      Send.a(
        GetRequest.to(`qc-inspections/${equipmentIdInQrPayload(payload)}`),
      ),
    ),
};

/**
 * «فعالیت های QC تجهیز «…» به او نشان داده شود» — the scan opened the equipment by that (current)
 * name, with the activities assigned to it now.
 */
export const EnsureShownTheQcActivitiesOf = (
  equipmentName: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures they were shown the QC activities of ${equipmentName}`,
    async (actor) => {
      await Ensure.that(LastResponse.status(), equals(200)).performAs(actor);
      const shown = await actor.answer(
        LastResponse.body<QcEquipmentReadModel>(),
      );
      await Ensure.that(shown.name, equals(equipmentName)).performAs(actor);
      const assigned = await readAsTheSystemAdmin<QcEquipmentReadModel>(
        `qc-equipment/${shown.id}`,
      );
      await Ensure.that(
        shown.activities.map((activity) => activity.activityName).sort(),
        equals(
          assigned.activities.map((activity) => activity.activityName).sort(),
        ),
      ).performAs(actor);
      await Ensure.that(shown.activities.length, isGreaterThan(0)).performAs(
        actor,
      );
    },
  );

// ---------------------------------------------------------------------------------------------
// The inspection page

/** «… فعالیت های QC تجهیز «…» را مشاهده می کند» — `/qc-inspection`, the equipment's table loaded. */
export const ViewTheQcActivitiesOf = {
  using: (equipmentName: string): Task =>
    Task.where(
      d`#actor looks at the QC activities of ${equipmentName}`,
      LocateQcInspectionPage(),
      WaitUntil(QcInspectionPage.loadingIndicator(), not(isPresent())),
      WaitUntil(
        QcInspectionPage.rowsOf(equipmentName).count(),
        isGreaterThan(0),
      ),
    ),
};

const ACTIVITY = 'فعالیت';

const byActivity = (rows: ListRow[]): ListRow[] =>
  [...rows].sort((a, b) =>
    (a[ACTIVITY] ?? '').localeCompare(b[ACTIVITY] ?? ''),
  );

/**
 * «آخرین انجام فعالیت های QC تجهیز «…» به صورت زیر باشد» — the equipment's table on the page shows
 * exactly these activities with these last executions, compared on the Gherkin's columns in
 * whatever order the page lists them.
 */
export const EnsureTheLastQcExecutionsShownFor = (
  equipmentName: string,
  expected: ListRow[],
): Task =>
  Task.where(
    d`#actor ensures the page shows the last QC executions of ${equipmentName} as ${expected}`,
    Ensure.that(
      Question.about(
        d`the last QC executions shown for ${equipmentName}`,
        async (actor) =>
          byActivity(
            onlyTheColumnsOf(
              expected,
              await actor.answer(
                TheRowsOf(d`the QC activities of ${equipmentName}`, {
                  columnHeaders: () =>
                    QcInspectionPage.columnHeadersOf(equipmentName),
                  rows: () => QcInspectionPage.rowsOf(equipmentName),
                  rowCells: QcInspectionPage.rowCells,
                }),
              ),
            ),
          ),
      ),
      equals(byActivity(expected)),
    ),
  );

/** «آخرین انجام «…» روی «…» «1405/07/01 11:30» باشد» — over every record of the pair, ever. */
export const EnsureTheLastQcExecutionOf = (
  activityName: string,
  equipmentName: string,
  at: QcInstant,
): Interaction =>
  Interaction.where(
    d`#actor ensures ${activityName} on ${equipmentName} was last done at ${at}`,
    async (actor) => {
      const folder = await readQcEquipment(
        actor,
        await theEquipmentIdNamed(actor, equipmentName),
      );
      const status = folder.activities.find(
        (activity) => activity.activityName === activityName,
      );
      await Ensure.that(
        status?.lastPerformedAt
          ? tehranJalaliDateTimeOf(status.lastPerformedAt)
          : null,
        equals(`${at.date} ${at.time}`),
      ).performAs(actor);
    },
  );
