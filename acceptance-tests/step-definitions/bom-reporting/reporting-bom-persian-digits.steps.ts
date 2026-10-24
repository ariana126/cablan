import { DataTable, Given, When } from '@cucumber/cucumber';
import { Actor } from '@serenity-js/core';
import { setCurrentReportKind } from '../../screenplay/common/report-context';
import { setCurrentDailyBomList } from '../../screenplay/common/daily-bom-list-context';
import { registerDailyBomsWithDefaults } from '../../screenplay/bom-reporting/bom-report-fixtures';
import { ViewBomReportList } from '../../screenplay/bom-reporting/bom-report-list';

// reporting-bom-persian-digits.feature — «جستجوی مقدار فیلتر با رقم فارسی».
//
// «و سینا وارد سیستم شده باشد» is the shared login precondition and «فقط آنالیز های روزانه با شماره
// سفارش ... نمایش داده شود» the shared report-list outcome, both in step-definitions/common.steps.ts.

// Passive — the daily BOMs only have to exist, so the API. The table names only order number,
// tracking number and MI code; `registerDailyBomsWithDefaults` fills in the rest. Sets both context
// flags explicitly, the way every owning step does, so the shared order-number Then reads the report
// list rather than whatever an earlier scenario left set.
Given(
  'اینکه آنالیز های روزانه زیر در سیستم ثبت شده باشند:',
  async (table: DataTable) => {
    setCurrentReportKind('bom');
    setCurrentDailyBomList('report');
    await registerDailyBomsWithDefaults(table.hashes());
  },
);

// Active, and the search box is the point — the browser, typed as given.
When(
  '{actor} لیست آنالیز های روزانه را با جستجوی {string} در فیلتر {string} مشاهده می کند',
  (actor: Actor, searchText: string, field: string) =>
    actor.attemptsTo(ViewBomReportList.filteredBySearching(field, searchText)),
);
