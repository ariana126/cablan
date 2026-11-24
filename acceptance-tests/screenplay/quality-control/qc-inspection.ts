import {
  d,
  Duration,
  Interaction,
  Question,
  Task,
  Wait,
} from '@serenity-js/core';
import { POLLING_INTERVAL, WaitUntil } from '../common/polling';
import { isGone } from '../common/is-gone';
import {
  Ensure,
  equals,
  isGreaterThan,
  isPresent,
  isTrue,
} from '@serenity-js/assertions';
import { GetRequest, LastResponse, Send } from '@serenity-js/rest';
import { Click, isVisible } from '@serenity-js/web';
import {
  InstallTheFakeCamera,
  ShowTheCameraTheQrOf,
} from '../common/fake-camera';
import { tehranJalaliDateTimeOf } from '../common/jalali-datetime';
import { readAsTheSystemAdmin } from '../common/observer';
import {
  ListRow,
  onlyTheColumnsOf,
  TheRowsOf,
} from '../maintenance-management/maintenance-pages';
import { theEquipmentNamed } from '../maintenance-management/maintenance-records';
import {
  QcInspectionPage,
  QcRecordingDialog,
  QcScanDialog,
} from '../ui/qc-inspection-page';
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
 * then. Scanning has two doors: «… QR چاپ شده قبلی را اسکن می کند» asks `GET qc-inspections/
 * :equipmentId` for the id it names — what the scanner does once it has decoded the image — while
 * «… QR تجهیز «…» را اسکن می کند» (the scan-only rule) holds the code in front of the page's real
 * scanner through a fake camera (`common/fake-camera.ts`), drawn from the same payload.
 * ASSUMPTION: the PDF carries exactly that payload; the suite neither downloads the PDF nor decodes
 * its image.
 *
 * **Recording starts from a scan only** (`docs/superpowers/specs/2026-11-24-qc-scan-only-
 * recording-design.md`). `/qc-inspection` lists every in-service equipment's activities with their
 * last execution and offers no way to record; a scan of an equipment's QR opens the recording
 * dialog for that equipment, and only that one.
 *
 * **Last executions.** «… فعالیت های QC تجهیز … را مشاهده می کند» (with or without «بدون اسکن QR»)
 * is the inspector looking at `/qc-inspection` — «آخرین انجام فعالیت های QC تجهیز … به صورت زیر
 * باشد» / «… به او نشان داده شود» read that page. «آخرین انجام «…» روی «…» «…» باشد» reads
 * `GET qc-equipment/:id`.
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

/**
 * How long a scan may take to be answered: the decoder is loaded only when the camera opens, reads
 * a frame about every half second, and the equipment is then looked up — longer than the suite's
 * default 5 s on a cold frontend.
 */
const SCAN_TIMEOUT = Duration.ofSeconds(15);

export const ScanTheQr = {
  /**
   * «… QR تجهیز «…» را اسکن می کند» — on `/qc-inspection`: «اسکن QR تجهیز», the equipment's QR
   * held in front of the (fake) camera, and the scan dialog waited for until it has closed — a
   * recognised code of recordable equipment closes it, so a refusal or an unread code fails here.
   */
  using: (equipmentName: string): Task =>
    Task.where(
      d`#actor scans the QR of ${equipmentName}`,
      InstallTheFakeCamera(),
      LocateQcInspectionPage(),
      WaitUntil(QcInspectionPage.loadingIndicator(), isGone()),
      Click.on(QcInspectionPage.scanButton()),
      WaitUntil(QcScanDialog.dialog(), isPresent()),
      ShowTheCameraTheQrOf(
        Question.about(d`the QR of ${equipmentName}`, () =>
          qrPayloadOf(theEquipmentNamed(equipmentName).id),
        ),
      ),
      Wait.upTo(SCAN_TIMEOUT)
        .until(QcScanDialog.dialog(), isGone())
        .pollingEvery(POLLING_INTERVAL),
    ),

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

/**
 * «… (بدون اسکن QR) فعالیت های QC تجهیز «…» را مشاهده می کند» — `/qc-inspection`, nothing scanned,
 * the equipment's table loaded.
 */
export const ViewTheQcActivitiesOf = {
  using: (equipmentName: string): Task =>
    Task.where(
      d`#actor looks at the QC activities of ${equipmentName}`,
      LocateQcInspectionPage(),
      WaitUntil(QcInspectionPage.loadingIndicator(), isGone()),
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

/** The names of the activities assigned to the equipment now, read as the System Admin. */
const assignedActivitiesOf = async (equipmentName: string): Promise<string[]> =>
  (
    await readAsTheSystemAdmin<QcEquipmentReadModel>(
      `qc-equipment/${theEquipmentNamed(equipmentName).id}`,
    )
  ).activities
    .map((activity) => activity.activityName)
    .sort((a, b) => a.localeCompare(b));

const LAST_EXECUTION = 'آخرین انجام';

/**
 * «آخرین انجام فعالیت های QC تجهیز «…» به او نشان داده شود» — the equipment's table lists exactly
 * its assigned activities, each with a last execution (a time, or «بدون سابقه»).
 */
export const EnsureShownTheLastQcExecutionsOf = (
  equipmentName: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures the page shows the last QC execution of every activity of ${equipmentName}`,
    async (actor) => {
      const rows = await actor.answer(
        TheRowsOf(d`the QC activities of ${equipmentName}`, {
          columnHeaders: () => QcInspectionPage.columnHeadersOf(equipmentName),
          rows: () => QcInspectionPage.rowsOf(equipmentName),
          rowCells: QcInspectionPage.rowCells,
        }),
      );
      await Ensure.that(
        rows
          .map((row) => row[ACTIVITY] ?? '')
          .sort((a, b) => a.localeCompare(b)),
        equals(await assignedActivitiesOf(equipmentName)),
      ).performAs(actor);
      await Ensure.that(
        rows.every((row) => (row[LAST_EXECUTION] ?? '').trim() !== ''),
        isTrue(),
      ).performAs(actor);
    },
  );

/**
 * «امکان ثبت انجام فعالیت های تجهیز «…» به او داده شود» — the recording dialog of that equipment is
 * open, with a checkbox for each activity assigned to it (and no other) and «ثبت انجام».
 */
export const EnsureOfferedToRecordTheQcActivitiesOf = (
  equipmentName: string,
): Interaction =>
  Interaction.where(
    d`#actor ensures they are offered to record the QC activities of ${equipmentName}`,
    async (actor) => {
      await WaitUntil(
        QcRecordingDialog.dialogOf(equipmentName),
        isVisible(),
      ).performAs(actor);
      const assigned = await assignedActivitiesOf(equipmentName);
      for (const activityName of assigned) {
        await Ensure.that(
          QcRecordingDialog.activityCheckbox(equipmentName, activityName),
          isPresent(),
        ).performAs(actor);
      }
      await Ensure.that(
        QcRecordingDialog.activityCheckboxes(equipmentName).count(),
        equals(assigned.length),
      ).performAs(actor);
      await Ensure.that(
        QcRecordingDialog.recordButton(equipmentName),
        isPresent(),
      ).performAs(actor);
    },
  );

/**
 * «امکان ثبت انجام فعالیت های تجهیز «…» به او داده نشود» — no dialog of that equipment is open,
 * and its section of the list (which must be there) holds no checkbox and no «ثبت انجام». The
 * section is read structurally, so the check holds even under another equipment's open dialog.
 */
export const EnsureNotOfferedToRecordTheQcActivitiesOf = (
  equipmentName: string,
): Task =>
  Task.where(
    d`#actor ensures they are not offered to record the QC activities of ${equipmentName}`,
    Ensure.that(
      QcRecordingDialog.dialogsNamed(equipmentName).count(),
      equals(0),
    ),
    Ensure.that(QcInspectionPage.equipmentSection(equipmentName), isPresent()),
    Ensure.that(
      QcInspectionPage.checkboxes()
        .of(QcInspectionPage.equipmentSection(equipmentName))
        .count(),
      equals(0),
    ),
    Ensure.that(
      QcInspectionPage.recordButtons()
        .of(QcInspectionPage.equipmentSection(equipmentName))
        .count(),
      equals(0),
    ),
  );
