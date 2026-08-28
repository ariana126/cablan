import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import { Actor, actorInTheSpotlight } from '@serenity-js/core';
import {
  currentReportKind,
  setCurrentReportKind,
} from '../../screenplay/common/report-context';
import { registerDailyBomReportFixtures } from '../../screenplay/bom-reporting/bom-report-fixtures';
import {
  EnsureMaterialWeightIsNotAFilterableField,
  EnsureReportColumnsAreExactly,
  ReselectAllValuesFor,
  ViewBomReportList,
} from '../../screenplay/bom-reporting/bom-report-list';
import {
  ComponentDetailRow,
  EnsureComponentDetailRowsAreExactly,
  EnsureDescriptionShown,
  EnsureStandardLengthShown,
  EnsureTotalWeightShown,
} from '../../screenplay/bom-reporting/bom-report-details';

// Steps whose text recurs across more than one .feature file within bom-reporting/ —
// defined once here so a per-file step-definitions file doesn't collide with another's.
//
// The seven steps below (columns, detail rows, standard length, description, total weight, the
// "عدم انتخاب مقدار ... اعمال کرده باشد"/"دوباره انتخاب می کند" pair, and the material-weight-not-
// filterable check) are shared, byte-for-byte, with reporting-standard-bom.feature — see
// `screenplay/common/report-context.ts`'s own comment for the full reasoning. Only the `'bom'`
// branch is implemented; `reporting-standard-bom.feature`'s own background is still a
// `return 'pending'` stub below, which is what keeps its scenarios from ever reaching the
// `'standard-bom'` branch.

Given(
  'اینکه آنالیز های روزانه زیر با اجزا و مواد اولیه شان در سیستم ثبت شده باشند:',
  async (table: DataTable) => {
    setCurrentReportKind('bom');
    await registerDailyBomReportFixtures(table);
  },
);

Given(
  'اینکه آنالیز های استاندارد زیر با اجزا و مواد اولیه شان در سیستم ثبت شده باشند:',
  (_table: DataTable) => {
    // reporting-standard-bom.feature: not automated yet. Whoever picks it up next should call
    // `setCurrentReportKind('standard-bom')` here — see `screenplay/common/report-context.ts`'s
    // own comment.
    return 'pending';
  },
);

Then('لیست فقط شامل ستون های زیر باشد', (table: DataTable) => {
  if (currentReportKind() === 'standard-bom') {
    return 'pending';
  }
  const [columns] = table.raw();
  return actorInTheSpotlight().attemptsTo(
    EnsureReportColumnsAreExactly(columns),
  );
});

Then(
  'جزئیات اجزا و مواد اولیه به صورت زیر نمایش داده شود',
  (table: DataTable) => {
    if (currentReportKind() === 'standard-bom') {
      return 'pending';
    }
    const rows: ComponentDetailRow[] = table.hashes().map((row) => ({
      componentName: row['نام جز'],
      materialName: row['نام مواد اولیه'],
      weight: row['وزن مواد اولیه'],
    }));
    return actorInTheSpotlight().attemptsTo(
      EnsureComponentDetailRowsAreExactly(rows),
    );
  },
);

Then('متراژ استاندارد {string} نمایش داده شود', (value: string) => {
  if (currentReportKind() === 'standard-bom') {
    return 'pending';
  }
  return actorInTheSpotlight().attemptsTo(EnsureStandardLengthShown(value));
});

Then('توضیحات {string} نمایش داده شود', (value: string) => {
  if (currentReportKind() === 'standard-bom') {
    return 'pending';
  }
  return actorInTheSpotlight().attemptsTo(EnsureDescriptionShown(value));
});

Then('جمع وزن مواد اولیه {string} نمایش داده شود', (value: string) => {
  if (currentReportKind() === 'standard-bom') {
    return 'pending';
  }
  return actorInTheSpotlight().attemptsTo(EnsureTotalWeightShown(value));
});

Given(
  'اینکه {actor} فیلتر {string} را با عدم انتخاب مقدار {string} اعمال کرده باشد',
  (actor: Actor, field: string, value: string) => {
    if (currentReportKind() === 'standard-bom') {
      return 'pending';
    }
    return actor.attemptsTo(
      ViewBomReportList.withValueDeselectedFor(field, value),
    );
  },
);

When(
  '{actor} همه مقادیر فیلتر {string} را دوباره انتخاب می کند',
  (actor: Actor, field: string) => {
    if (currentReportKind() === 'standard-bom') {
      return 'pending';
    }
    return actor.attemptsTo(ReselectAllValuesFor(field));
  },
);

Then('وزن مواد اولیه در فیلدهای قابل فیلتر نمایش داده نشود', () => {
  if (currentReportKind() === 'standard-bom') {
    return 'pending';
  }
  return actorInTheSpotlight().attemptsTo(
    EnsureMaterialWeightIsNotAFilterableField(),
  );
});

// Shared by exporting-bom.feature and exporting-standard-bom.feature: neither of these three
// mentions "روزانه" or "استاندارد", so the same text covers both files' exports.

Then('فایل اکسل خروجی شامل موارد زیر باشد', (_table: DataTable) => {
  return 'pending';
});

When(
  '{actor} از همان لیست فیلتر شده با فرمت {string} خروجی اکسل می گیرد',
  (_actor: Actor, _format: string) => {
    return 'pending';
  },
);

Then('فایل اکسل خروجی فقط شامل موارد زیر باشد', (_table: DataTable) => {
  return 'pending';
});
