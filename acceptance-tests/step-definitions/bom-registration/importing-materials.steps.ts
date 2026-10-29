import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import { Actor, actorCalled, actorInTheSpotlight } from '@serenity-js/core';
import {
  codeChangeRowOf,
  firstNewMaterialRows,
  removeAndConfirmThroughTheBrowser,
  rowsNamed,
  UploadAccountingExcel,
  uploadAndConfirmThroughTheBrowser,
  uploadThroughTheBrowser,
} from '../../screenplay/bom-registration/material-import';
import {
  ChangeListError,
  EnsureRowsMarkedWith,
  EnsureTheChangeListIsEmpty,
  EnsureTheChangeListShowsAnErrorFor,
  EnsureTheChangeListShowsOnly,
} from '../../screenplay/bom-registration/material-import-change-list';
import {
  ensureNewMaterialsCountIs,
  ensureTheMaterialsAreAsBefore,
  ensureTheMaterialsAreExactly,
  MaterialFact,
  registerMaterialsAsAPrecondition,
} from '../../screenplay/bom-registration/registered-materials';
import {
  NewMaterialDetails,
  rememberAttempt,
} from '../../screenplay/bom-registration/material-details';
import { statementsAboutMaterialsAre } from '../../screenplay/common/material-statement-context';

// Doors (acceptance-tests/CLAUDE.md): the active, non-«تلاش» `When`s drive `/materials` and its
// change-list dialog; so does the passive «اینکه … اکسلی بارگذاری کرده باشد که لیست تغییرات آن …
// است», because the `When` after it removes rows from and confirms the dialog that upload left
// open. The «تلاش …» attempt goes through the API. Facts about the system's materials are read over
// the API by an observer (`registered-materials.ts`); what the change list shows is read off the
// dialog. Shared with viewing-audit-log, and so in step-definitions/common.steps.ts: «هیچ تغییری در
// مواد اولیه سیستم اعمال نشده باشد», «کد مواد اولیه «…» «…» باشد» and «مواد اولیه «…» با کد «…»
// در سیستم ثبت شده باشد».

const materialsIn = (table: DataTable): MaterialFact[] =>
  table.hashes().map((row) => ({ name: row['نام'], code: row['کد'] }));

const excelItemsIn = (table: DataTable) =>
  table.hashes().map((row) => ({
    name: row['نام کالا'],
    code: row['کد کالا'],
  }));

// پیش زمینه — also tells the shared «مواد اولیه «…» با کد «…» در سیستم ثبت شده باشد» that, in this
// feature, it states an outcome.
Given('اینکه مواد اولیه زیر در سیستم ثبت شده باشند:', (table: DataTable) => {
  statementsAboutMaterialsAre('outcome');
  return registerMaterialsAsAPrecondition(materialsIn(table));
});

// قانون: هر ردیف اکسل اول از روی نام و سپس از روی کد با مواد اولیه موجود مقایسه می شود

When(
  '{actor} اکسلی با نام کالا {string} و کد کالا {string} بارگذاری می کند',
  (actor: Actor, name: string, code: string) =>
    uploadThroughTheBrowser(actor, [{ name, code }]),
);

// A regular expression, not `{string}`: the change it names carries quotes of its own («… شامل
// "تغییر کد "مسی" از "M-101" به "M-201"" باشد»).
Then(/^لیست تغییرات فقط شامل "(.*)" باشد$/, (change: string) =>
  actorInTheSpotlight().attemptsTo(EnsureTheChangeListShowsOnly([change])),
);

Then('هنوز هیچ تغییری در مواد اولیه سیستم اعمال نشده باشد', () =>
  ensureTheMaterialsAreAsBefore('the change'),
);

Then('لیست تغییرات خالی باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureTheChangeListIsEmpty()),
);

// قانون: مواد اولیه ای که در اکسل نیستند دست نخورده می مانند

When(
  '{actor} اکسلی با نام کالا {string} و کد کالا {string} بارگذاری و تایید می کند',
  (actor: Actor, name: string, code: string) =>
    uploadAndConfirmThroughTheBrowser(actor, [{ name, code }]),
);

Then('مواد اولیه زیر در سیستم ثبت شده باشند', (table: DataTable) =>
  ensureTheMaterialsAreExactly(materialsIn(table)),
);

// قانون: فقط تغییراتی اعمال می شوند که کاربر در لیست تغییرات نگه داشته است
// (and «… لیست تغییرات به طور کامل اعمال می شود یا هیچ بخشی از آن …», whose two examples state
// their upload the same way)

Given(
  /^اینکه ([^\s"]+) اکسلی بارگذاری کرده باشد که لیست تغییرات آن (.*) است$/,
  (importerName: string, description: string) =>
    actorCalled(importerName).attemptsTo(
      UploadAccountingExcel.describedAs(description),
    ),
);

When(
  '{actor} {int} مواد اولیه جدید و تغییر کد {string} را از لیست تغییرات حذف و آن را تایید می کند',
  (actor: Actor, count: number, name: string) =>
    removeAndConfirmThroughTheBrowser(actor, [
      ...firstNewMaterialRows(count),
      codeChangeRowOf(name),
    ]),
);

Then('{int} مواد اولیه جدید در سیستم ثبت شده باشد', (count: number) =>
  ensureNewMaterialsCountIs('the change', count),
);

// قانون: ردیف های مشکل دار اکسل در لیست تغییرات با خطا مشخص می شوند
//
// «خطای تکراری بودن کد مواد اولیه» names two errors: said of one row, its code belongs to another
// material (`code-taken`); said of several rows together, they repeat one code within the file
// (`duplicate-code-in-file`). The same reading gives «… اسم …» its in-file duplicate.

When(
  '{actor} اکسلی با ردیف های زیر بارگذاری می کند',
  (actor: Actor, table: DataTable) =>
    uploadThroughTheBrowser(actor, excelItemsIn(table)),
);

When(
  '{actor} اکسلی با نام کالا {string} و کد کالای خالی بارگذاری می کند',
  (actor: Actor, name: string) =>
    uploadThroughTheBrowser(actor, [{ name, code: '' }]),
);

When(
  '{actor} اکسلی با نام کالای خالی و کد کالا {string} بارگذاری می کند',
  (actor: Actor, code: string) =>
    uploadThroughTheBrowser(actor, [{ name: '', code }]),
);

Then(
  'ردیف {string} در لیست تغییرات با خطای تکراری بودن کد مواد اولیه مشخص شده باشد',
  (row: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureRowsMarkedWith(rowsNamed(row), ChangeListError.codeTaken),
    ),
);

Then(
  'ردیف های {string} در لیست تغییرات با خطای تکراری بودن اسم مواد اولیه مشخص شده باشند',
  (name: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureRowsMarkedWith(
        rowsNamed(name),
        ChangeListError.duplicateNameInFile,
      ),
    ),
);

Then(
  'ردیف های {string} و {string} در لیست تغییرات با خطای تکراری بودن کد مواد اولیه مشخص شده باشند',
  (first: string, second: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureRowsMarkedWith(
        [...rowsNamed(first), ...rowsNamed(second)],
        ChangeListError.duplicateCodeInFile,
      ),
    ),
);

Then(
  'ردیف {string} در لیست تغییرات با خطای کد مواد اولیه مشخص شده باشد',
  (row: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureRowsMarkedWith(rowsNamed(row), ChangeListError.codeRequired),
    ),
);

Then(
  'ردیف {string} در لیست تغییرات با خطای اسم مواد اولیه مشخص شده باشد',
  (row: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureRowsMarkedWith(rowsNamed(row), ChangeListError.nameRequired),
    ),
);

// قانون: لیست تغییرات یا به طور کامل اعمال می شود یا هیچ بخشی از آن اعمال نمی شود

When('{actor} لیست تغییرات را تایید می کند', (actor: Actor) =>
  removeAndConfirmThroughTheBrowser(actor, []),
);

Then('پیغام خطای ردیف {string} نشان داده شود', (row: string) =>
  actorInTheSpotlight().attemptsTo(
    EnsureTheChangeListShowsAnErrorFor(rowsNamed(row)),
  ),
);

When(
  '{actor} ردیف {string} را از لیست تغییرات حذف و آن را تایید می کند',
  (actor: Actor, row: string) =>
    removeAndConfirmThroughTheBrowser(actor, rowsNamed(row)),
);

// قانون: فقط مدیریت و مدیر سیستم مجاز به بارگذاری مواد اولیه از اکسل هستند
// («مواد اولیه جدیدی ثبت نشده باشد» — registring-material.steps.ts; «پیغام خطای عدم دسترسی نشان داده
// شود» — step-definitions/common.steps.ts. The attempt is remembered for the former.)

When(
  '{actor} تلاش می کند اکسلی با نام کالا {string} و کد کالا {string} بارگذاری کند',
  (actor: Actor, name: string, code: string) => {
    rememberAttempt<NewMaterialDetails>({ name, code });
    return actor.attemptsTo(
      UploadAccountingExcel.viaApiUsing([{ name, code }]),
    );
  },
);
