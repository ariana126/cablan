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
import { ExportStandardBomReportList } from '../../screenplay/bom-reporting/standard-bom-report-export';
import { toPersianDigits } from '../../screenplay/common/persian-digits';

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

// `weight` is a quantity, rendered through the detail dialog's `persianNumber` pipe
// (`bom-report-detail-dialog.ts`/`standard-bom-report-detail-dialog.ts`'s composition table), so
// the Gherkin's Latin-digit literal has to be converted before it can match — see
// `screenplay/common/persian-digits.ts`.
Then(
  'جزئیات اجزا و مواد اولیه به صورت زیر نمایش داده شود',
  (table: DataTable) => {
    const rows = table.hashes().map((row) => ({
      componentName: row['نام جز'],
      materialName: row['نام مواد اولیه'],
      weight: toPersianDigits(row['وزن مواد اولیه']),
    }));
    return actorInTheSpotlight().attemptsTo(
      currentReportKind() === 'standard-bom'
        ? EnsureStandardBomComponentDetailRowsAreExactly(rows)
        : EnsureBomComponentDetailRowsAreExactly(rows),
    );
  },
);

// Same `persianNumber`-piped quantity as above.
Then('متراژ استاندارد {string} نمایش داده شود', (value: string) =>
  actorInTheSpotlight().attemptsTo(
    currentReportKind() === 'standard-bom'
      ? EnsureStandardBomStandardLengthShown(toPersianDigits(value))
      : EnsureBomStandardLengthShown(toPersianDigits(value)),
  ),
);

// Description is free text, not a quantity — no digit conversion; it keeps whatever it was given.
Then('توضیحات {string} نمایش داده شود', (value: string) =>
  actorInTheSpotlight().attemptsTo(
    currentReportKind() === 'standard-bom'
      ? EnsureStandardBomDescriptionShown(value)
      : EnsureBomDescriptionShown(value),
  ),
);

// Same `persianNumber`-piped quantity as the standard-length step above.
Then('جمع وزن مواد اولیه {string} نمایش داده شود', (value: string) =>
  actorInTheSpotlight().attemptsTo(
    currentReportKind() === 'standard-bom'
      ? EnsureStandardBomTotalWeightShown(toPersianDigits(value))
      : EnsureBomTotalWeightShown(toPersianDigits(value)),
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
// mentions "روزانه" or "استاندارد", so the same text covers both files' exports.
//
// The two `Then` steps below need NO dispatch on `currentReportKind()`, unlike every other shared
// step in this file: `EnsureExportedWorkbookIsExactly`/`EnsureExportedWorkbookOnlyContains`
// (`bom-report-export.ts`) assert purely against the downloaded workbook grid
// (`screenplay/common/downloads.ts`) and never touch a Page Object or report kind at all, so one
// implementation already covers both features — see `standard-bom-report-export.ts`'s own module
// comment for the same reasoning. Only the `When` that TRIGGERS the export differs, since that
// drives a different report page through a different list-locating task.

Then('فایل اکسل خروجی شامل موارد زیر باشد', (table: DataTable) =>
  actorInTheSpotlight().attemptsTo(
    EnsureExportedWorkbookIsExactly(table.raw()),
  ),
);

When(
  '{actor} از همان لیست فیلتر شده با فرمت {string} خروجی اکسل می گیرد',
  (actor: Actor, format: string) =>
    actor.attemptsTo(
      currentReportKind() === 'standard-bom'
        ? ExportStandardBomReportList.fromTheCurrentlyFilteredList(format)
        : ExportDailyBomReportList.fromTheCurrentlyFilteredList(format),
    ),
);

Then('فایل اکسل خروجی فقط شامل موارد زیر باشد', (table: DataTable) =>
  actorInTheSpotlight().attemptsTo(
    EnsureExportedWorkbookOnlyContains(table.raw()),
  ),
);
