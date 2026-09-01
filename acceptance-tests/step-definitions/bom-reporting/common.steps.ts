import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import { Actor, actorInTheSpotlight } from '@serenity-js/core';
import {
  currentReportKind,
  setCurrentReportKind,
} from '../../screenplay/common/report-context';
import { registerDailyBomReportFixtures } from '../../screenplay/bom-reporting/bom-report-fixtures';
import { registerStandardBomReportFixtures } from '../../screenplay/bom-reporting/standard-bom-report-fixtures';
import {
  EnsureMaterialWeightIsNotAFilterableField,
  EnsureReportColumnsAreExactly as EnsureBomReportColumnsAreExactly,
  ReselectAllValuesFor as BomReselectAllValuesFor,
  ViewBomReportList,
} from '../../screenplay/bom-reporting/bom-report-list';
import {
  EnsureComponentDetailRowsAreExactly as EnsureBomComponentDetailRowsAreExactly,
  EnsureDescriptionShown as EnsureBomDescriptionShown,
  EnsureStandardLengthShown as EnsureBomStandardLengthShown,
  EnsureTotalWeightShown as EnsureBomTotalWeightShown,
} from '../../screenplay/bom-reporting/bom-report-details';
import {
  EnsureReportColumnsAreExactly as EnsureStandardBomReportColumnsAreExactly,
  ReselectAllValuesFor as StandardBomReselectAllValuesFor,
  ViewStandardBomReportList,
} from '../../screenplay/bom-reporting/standard-bom-report-list';
import {
  EnsureComponentDetailRowsAreExactly as EnsureStandardBomComponentDetailRowsAreExactly,
  EnsureDescriptionShown as EnsureStandardBomDescriptionShown,
  EnsureStandardLengthShown as EnsureStandardBomStandardLengthShown,
  EnsureTotalWeightShown as EnsureStandardBomTotalWeightShown,
} from '../../screenplay/bom-reporting/standard-bom-report-details';
import {
  EnsureExportedWorkbookIsExactly,
  EnsureExportedWorkbookOnlyContains,
  ExportDailyBomReportList,
} from '../../screenplay/bom-reporting/bom-report-export';

// Steps whose text recurs across more than one .feature file within bom-reporting/ —
// defined once here so a per-file step-definitions file doesn't collide with another's.
//
// Both "reporting-bom.feature" and "reporting-standard-bom.feature" share these steps:
// columns, detail rows, standard length, description, total weight, the
// "عدم انتخاب مقدار ... اعمال کرده باشد"/"دوباره انتخاب می کند" pair, and the
// material-weight-not-filterable check. Each dispatch on `currentReportKind()` to route to the
// correct implementation.

Given(
  'اینکه آنالیز های روزانه زیر با اجزا و مواد اولیه شان در سیستم ثبت شده باشند:',
  async (table: DataTable) => {
    setCurrentReportKind('bom');
    await registerDailyBomReportFixtures(table);
  },
);

Given(
  'اینکه آنالیز های استاندارد زیر با اجزا و مواد اولیه شان در سیستم ثبت شده باشند:',
  async (table: DataTable) => {
    setCurrentReportKind('standard-bom');
    await registerStandardBomReportFixtures(table);
  },
);

Then('لیست فقط شامل ستون های زیر باشد', (table: DataTable) => {
  const [columns] = table.raw();
  return actorInTheSpotlight().attemptsTo(
    currentReportKind() === 'standard-bom'
      ? EnsureStandardBomReportColumnsAreExactly(columns)
      : EnsureBomReportColumnsAreExactly(columns),
  );
});

Then(
  'جزئیات اجزا و مواد اولیه به صورت زیر نمایش داده شود',
  (table: DataTable) => {
    const rows = table.hashes().map((row) => ({
      componentName: row['نام جز'],
      materialName: row['نام مواد اولیه'],
      weight: row['وزن مواد اولیه'],
    }));
    return actorInTheSpotlight().attemptsTo(
      currentReportKind() === 'standard-bom'
        ? EnsureStandardBomComponentDetailRowsAreExactly(rows)
        : EnsureBomComponentDetailRowsAreExactly(rows),
    );
  },
);

Then('متراژ استاندارد {string} نمایش داده شود', (value: string) =>
  actorInTheSpotlight().attemptsTo(
    currentReportKind() === 'standard-bom'
      ? EnsureStandardBomStandardLengthShown(value)
      : EnsureBomStandardLengthShown(value),
  ),
);

Then('توضیحات {string} نمایش داده شود', (value: string) =>
  actorInTheSpotlight().attemptsTo(
    currentReportKind() === 'standard-bom'
      ? EnsureStandardBomDescriptionShown(value)
      : EnsureBomDescriptionShown(value),
  ),
);

Then('جمع وزن مواد اولیه {string} نمایش داده شود', (value: string) =>
  actorInTheSpotlight().attemptsTo(
    currentReportKind() === 'standard-bom'
      ? EnsureStandardBomTotalWeightShown(value)
      : EnsureBomTotalWeightShown(value),
  ),
);

Given(
  'اینکه {actor} فیلتر {string} را با عدم انتخاب مقدار {string} اعمال کرده باشد',
  (actor: Actor, field: string, value: string) =>
    actor.attemptsTo(
      currentReportKind() === 'standard-bom'
        ? ViewStandardBomReportList.withValueDeselectedFor(field, value)
        : ViewBomReportList.withValueDeselectedFor(field, value),
    ),
);

When(
  '{actor} همه مقادیر فیلتر {string} را دوباره انتخاب می کند',
  (actor: Actor, field: string) =>
    actor.attemptsTo(
      currentReportKind() === 'standard-bom'
        ? StandardBomReselectAllValuesFor(field)
        : BomReselectAllValuesFor(field),
    ),
);

Then('وزن مواد اولیه در فیلدهای قابل فیلتر نمایش داده نشود', () =>
  actorInTheSpotlight().attemptsTo(EnsureMaterialWeightIsNotAFilterableField()),
);

// Shared by exporting-bom.feature and exporting-standard-bom.feature: neither of these three
// mentions "روزانه" or "استاندارد", so the same text covers both files' exports. Only the 'bom'
// branch is wired to real behaviour here — exporting-standard-bom.feature is out of scope for this
// pass, and its own scenarios never actually reach these `'standard-bom'` branches anyway, since
// its background (`آنالیز های استاندارد ... ثبت شده باشند`) never runs for THIS feature's own
// scenarios and its own per-file steps (`exporting-standard-bom.steps.ts`) are still `'pending'`
// stubs that stop the scenario before a shared `Then` here could ever run. Kept explicit rather
// than silently falling through to the 'bom' implementation, so a future implementer building
// exporting-standard-bom.feature's own export screenplay gets a clear signal here, the same way
// `screenplay/common/report-context.ts`'s own comment already documents for the OTHER shared steps
// in this file.

Then('فایل اکسل خروجی شامل موارد زیر باشد', (table: DataTable) => {
  if (currentReportKind() === 'standard-bom') {
    return 'pending';
  }
  return actorInTheSpotlight().attemptsTo(
    EnsureExportedWorkbookIsExactly(table.raw()),
  );
});

When(
  '{actor} از همان لیست فیلتر شده با فرمت {string} خروجی اکسل می گیرد',
  (actor: Actor, format: string) => {
    if (currentReportKind() === 'standard-bom') {
      return 'pending';
    }
    return actor.attemptsTo(
      ExportDailyBomReportList.fromTheCurrentlyFilteredList(format),
    );
  },
);

Then('فایل اکسل خروجی فقط شامل موارد زیر باشد', (table: DataTable) => {
  if (currentReportKind() === 'standard-bom') {
    return 'pending';
  }
  return actorInTheSpotlight().attemptsTo(
    EnsureExportedWorkbookOnlyContains(table.raw()),
  );
});
