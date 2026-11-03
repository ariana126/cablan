# Activity specialty and operating hours — plan

Design: `docs/superpowers/specs/2026-11-03-activity-specialty-and-operating-hours-design.md`.

## Pinned HTTP contract

On the wire a specialty is `"electrical"` («برق») or `"mechanical"` («مکانیک»), and `null` when
absent.

| Route | Change |
|---|---|
| `POST /api/maintenance-activities` | body `{ name: string, specialty: "electrical"\|"mechanical" }`, both required → 201 `{ id }` |
| `PATCH /api/maintenance-activities/:id` | body `{ name: string, specialty: "electrical"\|"mechanical" }` → 204; 409 `record-has-dependents` while any plan item uses the activity |
| `GET /api/maintenance-activities` | each item `{ id, name, specialty: string\|null }` |
| `GET /api/maintenance-activities/unassigned-specialties` | **new**, SystemAdmin only → `{ id, name }[]`, sorted by Persian name |
| `POST /api/maintenance-activities/specialty-assignment` | **new**, SystemAdmin only, body `{ assignments: { activityId: uuid, specialty }[] }` → 204; 400 `specialty-assignment-incomplete` (detail «تخصص همه فعالیت ها باید تعیین شود.»); 403 for any other role |
| `POST /api/equipment/:id/pm-plan-items/:itemId/executions` | body `{ notes?: string, operatingHours?: number }`, with `operatingHours` ≥ 0, ≤ 1000000, ≤ 2 decimals |
| `GET /api/equipment/:id/maintenance-history` | each row adds `activitySpecialty: string\|null` and `operatingHours: number\|null` |
| `GET /api/equipment/:id` | each `planItems[]` and `inactivePlanItems[]` entry adds `activitySpecialty` |
| `GET /api/pm-schedule/daily` | each row adds `activitySpecialty` |
| `GET /api/pm-schedule/overview`, `/calendar` | new optional query parameter `specialty`; each row adds `activitySpecialty` |
| `GET /api/pm-schedule/filter-options` | each `activities[]` entry adds `specialty` |
| `POST /api/testing/maintenance/legacy-activities` | **new, `NODE_ENV=test` only**, body `{ name }` → 201 `{ id }`; creates an activity with no specialty |

## QA (acceptance-tests)

- Automate every new and changed scenario the design lists.
- Update the existing activity setup, through the API and the UI, to send a specialty. Existing
  scenarios that register an activity without naming a specialty use a default, e.g. mechanical.
- Set up the legacy precondition through `POST /api/testing/maintenance/legacy-activities`.
- Map the error messages:
  - no specialty → the form's specialty error;
  - invalid operating hours → the field's error;
  - incomplete assignment → `specialty-assignment-incomplete`.

## Backend (backend/src/modules/maintenance)

1. **Domain.**
   - A new `ActivitySpecialty` value object.
   - `MaintenanceActivity` gains `specialty: ActivitySpecialty|null` and three methods:
     - `register(name, specialty)`;
     - `edit(name, specialty)`, which records `MaintenanceActivityRenamed` and a new
       `MaintenanceActivitySpecialtyChanged`;
     - `assignLegacySpecialty(specialty)`, which throws unless the specialty is null and records
       `MaintenanceActivitySpecialtyAssigned`.
   - `MaintenanceExecution` gains `operatingHours: OperatingHours|null`, a value object that
     holds a number ≥ 0.
2. **Application.**
   - `RegisterMaintenanceActivity` takes a specialty.
   - `RenameMaintenanceActivity` becomes `EditMaintenanceActivity`: name and specialty, still
     calling `assertNoDependents`.
   - A new `AssignLegacySpecialties` command, all-or-nothing, inside `UnitOfWork`.
   - A new `ListUnassignedSpecialties` query.
   - `RecordMaintenanceExecution` takes operating hours.
   - Read models add `activitySpecialty`, `specialty` and `operatingHours`.
   - The range queries take `specialty`.
3. **Infrastructure.**
   - A migration adding the nullable `specialty` text column and `operating_hours numeric(9,2)`.
   - DTOs, controllers and the exception mapper.
   - The test-only maintenance testing controller.
   - Audit projections for the new events.
   - The regenerated OpenAPI spec.

## Frontend (frontend/)

1. **Navigation.** The «فنی» menu gets a «گزارشات» folder, with the same icon as
   quality-control's «گزارشات», holding «داشبورد مدیریتی فنی».
2. **Activity create/edit dialog.** A required «تخصص» radio group (برق / مکانیک). The activity
   list shows each activity's specialty.
3. **Legacy modal.** When a SystemAdmin signs in and `unassigned-specialties` is non-empty, a modal
   lists those activities, each with a required specialty choice. Submit is enabled only once all
   are chosen. The modal never shows again once the list is empty.
4. **Daily PM list.** One section per equipment, titled with its name. Inside each section,
   «برق» and «مکانیک» groups, plus «تخصص تعیین نشده» if any activity lacks a specialty. Each row
   keeps its due date, status, days overdue and «ثبت انجام».
5. **PM schedule (`pm-schedule`).** A «تخصص» filter (همه / برق / مکانیک, default همه) beside
   «انجام‌دهنده». It applies to the table and the calendar, survives a view switch, and «clear
   filters» resets it to همه.
6. **Equipment folder.** Plan items and inactive items are each grouped into «برق» and «مکانیک».
7. **Record-execution dialog.** An optional numeric field «ساعت کارکرد دستگاه» (unit: ساعت), ≥ 0.
   The history detail shows the specialty and either «N ساعت» or «ثبت نشده».
