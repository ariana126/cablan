# QC recording only after a QR scan — design

## Capability

Anyone who records a QC activity (QC inspector, Management, Factory Manager, System Admin) does it
only after scanning the equipment's QR, and only for that equipment: the scan is the sign the
person stood at the machine. There is no fallback, so a damaged QR or a broken camera means the
recording waits. Without a scan, `/qc-inspection` only shows each equipment's activities and their
last execution.

The approved Gherkin is in `acceptance-tests/specs/quality-control/recording-qc-execution.feature`
(commit 827f3de), under the rule «انجام فعالیت QC فقط پس از اسکن QR تجهیز ثبت می شود». Both
scenarios are **UI-voiced**:

- **الگوی سناریو: بدون اسکن QR امکان ثبت انجام داده نمی شود** — نیکروش, مصطفی, کامرانی, یاشار.
- **سناریو: اسکن QR فقط ثبت انجام همان تجهیز را ممکن می کند**

## History

Issue #119 built the page so that recording started from a scan only: a list you could view, and a
recording dialog that opened after a scan. Issue #132 (multi-activity recording) turned that list
into the checklist itself, so it could be recorded without a scan, and no scenario caught the
change. This feature restores #119's flow and keeps #132's checklist, which now lives in the
dialog that opens after a scan.

## Approaches

1. **Restore #119's flow and put #132's checklist in the post-scan dialog (chosen).** The list goes
   back to view only. A recognised scan opens a recording dialog for that equipment alone,
   containing the existing `QcEquipmentChecklist` together with its submission flow. Nothing on the
   backend changes.
2. **Plain revert of the #132 frontend.** This would pass the new rule but fail #132's scenarios:
   the old dialog recorded one activity at a time, each with its own tracking number. Rejected.
3. **Enforce the scan on the server** (a scan token the API checks). This gives real proof, not
   just app behaviour, but it is a bigger change that nobody asked for. Out of scope; the app
   enforces the rule.

## Decisions

- **No backend change; API-only steps are unaffected.** The rule is app behaviour. The API still
  accepts a record from anyone the role check admits, so the existing API-door scenarios and the
  steps written as «تلاش …» keep working.
- **The page** is #119's shape again. It has the h1 «بازرسی حین تولید», the filled «اسکن QR
  تجهیز» button, and a data sheet. Each equipment's `<section>` is named by its `h3`, around a
  table that reads exactly «فعالیت» | «آخرین انجام». Each activity cell is **plain text**. The page
  has no checkbox, no «توضیحات» field and no «ثبت انجام» button.
- **Scan → recording dialog.** `QcScanDialog` stays as it is, including all its messages and
  `?scan=true`. When it closes with an equipment, the page opens `QcRecordingDialog`:
  - **Accessible name:** exactly the equipment's name, taken from its title.
  - **Content:** that equipment's checklist, which is the current `QcEquipmentChecklist` content.
    Each activity has a `mat-checkbox` named exactly by the activity and «آخرین انجام». A ticked
    row gets «توضیحات {activity}». The «ثبت انجام» button opens `QcSubmissionDialog`, stacked on
    top, exactly as today.
  - **Leaving it:** the footer has one button, «پایان», which carries the close icon. Do not use
    «بستن» anywhere in this dialog: that name belongs to `QcSubmissionDialog`, where the suite
    reads it as the sign that the answer has arrived.
  - **When it closes:** if anything was recorded, the list is read again. Focus goes back to
    «اسکن QR تجهیز».
- **The pending submission survives the dialog.** `QcChecklist` stays page-scoped, not
  dialog-scoped. Say a sending goes unanswered, the person closes the recording dialog, and then
  scans the same equipment again. The same ticks and notes must reopen the pending submission with
  the same `submissionId`, keeping #132's idempotency.
- **Scanning one equipment never offers another's activities.** Only the scanned equipment's
  checklist is shown.
- **Test seam: none in the product.** The acceptance suite fakes the camera at the browser level,
  through a public interface, the page itself:
  - An init script replaces `navigator.mediaDevices.getUserMedia`, defining `mediaDevices` when the
    origin is not secure.
  - The replacement returns `canvas.captureStream()` from a canvas showing a QR image the suite
    drew for `CABLAN-EQ:<id>`.
  - The real `@zxing/browser` reader then decodes the picture.

  The frontend's a11y audit can use the same trick to grade the recording dialog.

## Risks

- **Secure context.** The suite's browser reaches the frontend over plain http on a non-localhost
  host, where `navigator.mediaDevices` is absent. The fake must define it, or Chromium must be
  given `--unsafely-treat-insecure-origin-as-secure`. QA decides which.
- **Decoding speed.** ZXing decoding a canvas stream in headless Chromium should take well under
  the step's timeout. The QR must be drawn large, with a quiet zone, on a white background.
- **Recording steps that went through the UI** now have to scan first, through the same fake. #132
  put the plain «… با هم ثبت می کند» step on the UI door; it will fail until it scans.
