# Technical management dashboard (issue #89) — plan

Design: `docs/superpowers/specs/2026-11-01-technical-management-dashboard-design.md`.

## HTTP contract (pinned)

`GET /api/pm-dashboard?periodDays=30&equipmentId=<uuid>` — roles SystemAdmin, TechnicalManager.
`periodDays` ∈ {7, 30, 90}, default 30 (else 400 `validation-error`). `equipmentId` optional
(unknown → the framework's existing entity-not-found 404). PmInspector, QualityControlInspector, Manager, Reporter → 403.

```ts
PmDashboardResponse {
  today: string;             // ISO date, Tehran
  generatedAt: string;       // ISO instant (Clock)
  periodDays: number;        // 7 | 30 | 90
  periodFrom: string;        // ISO date = today − (periodDays − 1)
  periodTo: string;          // ISO date = today
  current: { dueToday: number; overdue: number; doneToday: number };
  missedCount: number;       // missed occurrences whose missedOn ∈ [periodFrom, today]
  performance: PmDashboardPerformance;
  trend: { daily: PmDashboardTrendPoint[]; weekly: PmDashboardTrendPoint[] };
  coverage: {
    activeEquipment: number; withPlan: number; withoutPlan: number;
    coveragePercent: number | null;               // integer, null when activeEquipment = 0
    equipmentWithoutPlan: { id: string; name: string }[];   // byPersianName
  };
  mostOverdueEquipment: { equipmentId: string; equipmentName: string;
                          overdueCount: number; totalDaysOverdue: number }[];
  upcoming: { equipmentId: string; equipmentName: string; planItemId: string;
              activityName: string; dueDate: string }[];
  occurrences: PmDashboardOccurrence[];
}
PmDashboardPerformance {
  considered: number; onTime: number; late: number; notDone: number;
  adherencePercent: number | null;    // round(100·onTime/considered)
  completionPercent: number | null;   // round(100·(onTime+late)/considered)
  averageDaysLate: number | null;     // one decimal
}
PmDashboardTrendPoint { from: string; to: string; considered: number; onTime: number; late: number;
                        adherencePercent: number | null; completionPercent: number | null }
PmDashboardOccurrence {
  equipmentId: string; equipmentName: string; equipmentRetired: boolean;
  planItemId: string; activityId: string; activityName: string;
  dueDate: string; status: PmOccurrenceStatus;     // on_time | late | missed | overdue | due | upcoming
  daysOverdue: number; daysLate: number | null;
  missedOn: string | null;                         // the day it turned missed
  performedAt: string | null; performedByName: string | null; notes: string | null;
  doneToday: boolean; recordable: boolean;
}
```

## QA (`acceptance-tests/`)

- Automate every scenario of `specs/maintenance-management/technical-management-dashboard.feature`.
  Reuse the maintenance steps that already exist (equipment registration, plan items, «امروز … باشد»,
  recordings on named days, deactivation, retirement) — no redefinitions.
- UI door for «… مشاهده می کند» and the `Then`s that read the page; API door for the «تلاش …»
  outline (`GET pm-dashboard` → 403) and every precondition.
- New Lean Page Object `screenplay/ui/pm-dashboard-page.ts` with `ASSUMPTION` locators matching the
  markup below.

## Backend (`backend/src/modules/maintenance/`)

- Query `GetPmDashboardQuery { periodDays, equipmentId? }` + handler + read model
  (`PmDashboardReadModel`) built on `PmPlanReader` / `PmOccurrences`; any new pure calculation
  (performance, missedOn, ranking, trend buckets) in the domain or an application service with unit
  tests covering every Gherkin example.
- Controller `GET /pm-dashboard`, DTOs as above, OpenAPI regenerated.
- Load per item only the occurrences in `[periodFrom, today + 7]` plus the one just before
  `periodFrom` (the only earlier one that can be currently overdue or turn missed inside the
  period), and executions for those plus those performed today.

## Frontend (`frontend/`)

- Route `/pm-dashboard`, title «داشبورد مدیریتی فنی · کابلان», `<h1>` «داشبورد مدیریتی فنی», first page
  of «فنی» in `navigation.ts`, roles SystemAdmin + TechnicalManager. Do not change home shortcuts.
- Markup contract (accessible names QA will use):
  - Filters: `mat-select` «بازه زمانی» (options «7 روز اخیر», «30 روز اخیر» default, «90 روز اخیر»),
    `mat-select` «تجهیز» (first option «همه تجهیزات», then `GET /equipment` names), `mat-select`
    «وضعیت», text field «جستجو»; button «به‌روزرسانی»; text «آخرین به‌روزرسانی: …».
  - Current cards, each a button whose accessible name starts with its title and holds its number:
    «سررسید امروز», «عقب افتاده», «انجام شده امروز», «موعدهای ازدست رفته».
  - Region «عملکرد PM»: labelled values «درصد پایبندی», «درصد تکمیل» («70%» or «داده کافی وجود
    ندارد»), «انجام شده بموقع», «انجام شده با تاخیر», «میانگین روزهای تاخیر» («3 روز», «-» when null);
    trend chart with «روزانه» / «هفتگی» toggle and an accessible table/summary per point.
  - Region «پوشش برنامه PM»: «تجهیزات فعال», «دارای برنامه», «فاقد برنامه», «درصد پوشش» («50%» or
    «—»), donut, button «فاقد برنامه» listing equipment (links to `/pm-plans/:id`).
  - Region «بیشترین عقب افتادگی»: table columns «تجهیز», «تعداد کار عقب افتاده», «جمع روزهای تاخیر».
  - Region «برنامه هفت روز آینده»: table columns «تجهیز», «فعالیت», «موعد» (Jalali `yyyy/MM/dd`).
  - Region «فعالیت های نیازمند پیگیری»: sortable table «تجهیز», «فعالیت», «تاریخ سررسید», «وضعیت»,
    «مقدار تاخیر», «عملیات» (details, «ثبت انجام» when `recordable`), export button «خروجی اکسل».
- Recording reuses the existing record-execution dialog/gateway, then reloads the dashboard.
- Register the route in `a11y/accessibility.spec.ts`.
