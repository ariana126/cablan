# QC recording only after a QR scan — plan

Design: `docs/superpowers/specs/2026-11-24-qc-scan-only-recording-design.md`.

The scenarios are under «انجام فعالیت QC فقط پس از اسکن QR تجهیز ثبت می شود» in
`acceptance-tests/specs/quality-control/recording-qc-execution.feature`. Nothing on the HTTP
surface changes and no backend work is needed, so steps 3 and 4 and the contract sync are skipped.

## Markup contract (pinned for QA and frontend, who work in parallel)

**`/qc-inspection` without a scan:**
- Each equipment is a `<section>` (role `region`) named by its `h3`, which holds exactly the
  equipment's name.
- Inside each section is a table «فعالیت» | «آخرین انجام». Activity cells are plain text.
- No `checkbox` role and no «ثبت انجام» button appear anywhere on the page outside a dialog.

**Scanning:**
- «اسکن QR تجهیز» (filled) opens `QcScanDialog`.
- A decoded `CABLAN-EQ:<uuid>` of equipment that can be recorded on closes that dialog.
- `QcRecordingDialog` then opens:
  - `role="dialog"`, its accessible name exactly the equipment's name;
  - per assigned activity, a `checkbox` named exactly by the activity;
  - a ticked activity gets a textbox «توضیحات {activity}»;
  - a button «ثبت انجام» opens `QcSubmissionDialog`, which is unchanged: «شماره ردیابی»,
    «انصراف» / «ثبت», then per activity «ثبت شد» / «ثبت نشد», and «بستن»;
  - the footer has «پایان», which closes the recording dialog. No button in it is named «بستن».

**Camera:** the product reads frames from `navigator.mediaDevices.getUserMedia({ video: … })`
through `@zxing/browser`. The suite's fake must satisfy that call and nothing more.

## QA (`qa-engineer`)

1. **Fake camera (Technical layer).**
   - Add an ability or interaction that installs a browser init script. The script defines
     `navigator.mediaDevices` if it is missing and replaces `getUserMedia` so it returns a
     `canvas.captureStream()`.
   - Add an interaction that "points the camera at" a payload. It draws a QR of `CABLAN-EQ:<id>`
     onto that canvas: large, with a quiet zone, on white.
   - Draw the QR with an established encoder added through npm, such as `qrcode`.
   - If the origin is not a secure context, either define `mediaDevices` or launch Chromium with
     `--unsafely-treat-insecure-origin-as-secure=<frontend origin>`. Your call; say which.
2. **New steps (Business Flow), UI door:**
   - «{actor} بدون اسکن QR فعالیت های QC تجهیز "X" را مشاهده می کند»: open `/qc-inspection`,
     scanning nothing.
   - «انتظار می رود آخرین انجام فعالیت های QC تجهیز "X" به او نشان داده شود»: X's section shows
     its activities and their «آخرین انجام».
   - «و امکان ثبت انجام فعالیت های تجهیز "X" به او داده نشود»: the page has no checkbox or
     «ثبت انجام» for X, and no open recording dialog is named X.
   - «{actor} QR تجهیز "X" را اسکن می کند»: open `/qc-inspection`, press «اسکن QR تجهیز», and show
     X's QR to the fake camera.
   - «انتظار می رود امکان ثبت انجام فعالیت های تجهیز "X" به او داده شود»: a dialog named X with a
     checkbox per X's assigned activity and «ثبت انجام».
3. **Existing UI recording tasks must scan first.** This covers #132's plain «… با هم ثبت می
   کند» and any other recording through `/qc-inspection`. They must:
   - scan the equipment through the fake;
   - then tick in the recording dialog;
   - then «ثبت انجام» → «شماره ردیابی» → «ثبت» → wait for «بستن».

   Update `ui/qc-inspection-page.ts` to the contract above, with locators scoped to the dialog. Fix
   the doc comments that say the list records without a scan.
4. Typecheck clean.

## Frontend (`frontend-engineer`)

1. **`QcInspectionPage`:**
   - Go back to the view-only list: plain activity text, no checkbox, notes or «ثبت انجام».
   - After `QcScanDialog` closes with an equipment, open `QcRecordingDialog` for it, with
     `restoreFocus` set to «اسکن QR تجهیز».
   - When that dialog closes, re-read the list if anything was recorded.
2. **`QcRecordingDialog`** (new):
   - `app-dialog-head` titled with the equipment's name and no close button (a close named «بستن»
     would collide with the submission dialog's).
   - The checklist content of today's `QcEquipmentChecklist`, reused rather than copied.
   - Footer «پایان».
3. **Keep the pending submission page-scoped.** `QcChecklist` must outlive the recording dialog.
   Reopening it for the same equipment, with unchanged ticks and notes, must resume the pending
   submission under the same `submissionId`.
4. **Specs:**
   - Page: no checkbox and no «ثبت انجام» without a scan; a fake scanner's text opens the recording
     dialog for that equipment only.
   - Dialog: recording, «پایان», and resume-after-unanswered across a close and reopen.
5. **`a11y/accessibility.spec.ts`:**
   - Grade the recording dialog, with its "choose one" alert and a ticked row's notes, by faking
     `getUserMedia` with a canvas QR in the audit's browser. The old route-level checklist states
     no longer exist on the page.
   - Keep the submission-dialog audit.
6. **Update `frontend/CLAUDE.md`'s «Production QC» `/qc-inspection` bullets** so they describe the
   new flow. Recording starts from a scan only.
