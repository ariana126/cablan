# Daily BOM preview — design

Issue #50. After a QC operator registers a daily BOM, a preview dialog shows how far each
material's weight lies from the standard BOM, so a typo or a real deviation is caught at once.

## Scenarios (`acceptance-tests/specs/bom-registration/registring-bom.feature`, new rule)

All four are **UI-voiced** — the preview only exists in the browser:

- مشاهده پیش نمایش اختلاف وزن پس از ثبت آنالیز روزانه
- تایید پیش نمایش آنالیز روزانه
- ویرایش آنالیز روزانه از پیش نمایش
- اعمال قوانین ویرایش آنالیز روزانه هنگام ویرایش از پیش نمایش

The issue carried no `cablan:gherkin-proposal` comment, so the orchestrator wrote these from the
issue's acceptance criteria.

## Slice

- **Backend** — one new read-only query, `GET /api/boms/{id}/weight-differences`. It returns the
  same per-line shape the dashboard's daily-BOM list already computes (`componentId`,
  `componentName`, `materialId`, `materialName`, `actualWeight`, `standardWeight`, `difference`
  = |actual − standard|), wrapped as `{ lines: [...] }`. The calculation lives in the backend,
  next to the dashboard's, rather than being re-derived in the browser from two reads. Same
  authorization as `GET /api/boms/{id}`; 404 with the existing BOM-not-found problem type.
  No write, no aggregate change, no audit entry.
- **Frontend** — after a successful registration the BOMs page opens a `BomPreviewDialog`
  (title «پیش‌نمایش آنالیز روزانه»). It loads the endpoint above and lists نام جز, نام مواد
  اولیه, وزن مواد اولیه and اختلاف وزن; the difference reuses `app-weight-difference` (arrow and
  colour pill, empty cell at zero) exactly as the dashboard does, and the standard weight is not
  shown. Direction = `actualWeight > standardWeight ? 'above' : 'below'`. Two actions:
  **تایید** closes it and changes nothing; **ویرایش** closes it and opens the existing
  `BomFormDialog` in edit mode for that BOM, so every edit rule and its audit entry apply
  unchanged.
- **QA** — automate the four scenarios. Registration happens through the UI (the preview is its
  consequence); "registered and then edited" is checked through the audit-log API.

## Decisions

- Registration commits before the preview opens; the preview never holds back the write.
  Confirm is a no-op on the server.
- A new endpoint instead of widening `GET /api/boms/{id}`: the detail read model feeds the edit
  form, and the deviation is an analysis concern that already lives with the dashboard query.
