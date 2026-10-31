import { DataTable, Given, Then, When } from '@cucumber/cucumber';
import { Actor, actorCalled, actorInTheSpotlight } from '@serenity-js/core';
import {
  EnsureHomePageShortcutsAre,
  HomePageShortcut,
  ViewHomePage,
} from '../../screenplay/home/home-page-shortcuts';
import {
  EnsureComponentListShown,
  EnsureDailyBomDashboardShown,
  OpenFromTheMainMenu,
} from '../../screenplay/home/main-menu-access';
import { registerDailyBomFromTheHomePage } from '../../screenplay/home/register-from-home';
import { ChangeRoleOfPersona } from '../../screenplay/authentication/edit-user';
import { asSystemRole } from '../../screenplay/common/roles';
import { LogInAsPersona } from '../../screenplay/common/personas';
import { keepingTheSpotlight } from '../../screenplay/common/spotlight';

// «اینکه {actor} وارد سیستم شده باشد» — step-definitions/common.steps.ts.
// «آنالیز روزانه جدیدی ثبت شده باشد» — step-definitions/bom-registration/registring-bom.steps.ts
// (reads `GET boms` for the attempt this file's registration step remembers).

// قانون: هر نقش دقیقاً میانبرهای تأیید شده خود را … در صفحه اصلی می بیند

When('{actor} صفحه اصلی را مشاهده می کند', (actor: Actor) =>
  actor.attemptsTo(ViewHomePage()),
);

Then('میانبرهای صفحه اصلی او دقیقاً به صورت زیر باشد', (table: DataTable) =>
  actorInTheSpotlight().attemptsTo(
    EnsureHomePageShortcutsAre(
      table.hashes().map((row): HomePageShortcut => ({
        group: row['گروه'],
        shortcut: row['میانبر'],
      })),
    ),
  ),
);

// قانون: میانبر ثبت آنالیز روزانه جدید، ثبت را مستقیماً آغاز می کند

When(
  '{actor} از صفحه اصلی ثبت آنالیز روزانه جدیدی را آغاز می کند و آن را با اطلاعات معتبر ثبت می کند',
  registerDailyBomFromTheHomePage,
);

// قانون: میانبرهای صفحه اصلی همیشه از نقش فعلی کاربر پیروی می کنند
//
// Passive, so the API: the persona's account is provisioned (logging them in, which also leaves
// their credentials on their own notepad for the browser login that follows), then the admin
// changes the role. Nobody is left in the spotlight but the persona whose role changed.
Given(
  'اینکه نقش {actorName} توسط {actorName} از {string} به {string} تغییر داده شده باشد',
  async (personaName: string, adminName: string, from: string, to: string) => {
    await actorCalled(personaName).attemptsTo(LogInAsPersona(personaName));
    await keepingTheSpotlight(() =>
      actorCalled(adminName).attemptsTo(
        LogInAsPersona(adminName),
        ChangeRoleOfPersona(personaName, asSystemRole(from), asSystemRole(to)),
      ),
    );
    actorCalled(personaName);
  },
);

// قانون: نبودن یک بخش در میانبرهای صفحه اصلی، دسترسی کاربر به آن بخش را از بین نمی برد

When('{actor} داشبورد روزانه را از منوی اصلی باز می کند', (actor: Actor) =>
  actor.attemptsTo(OpenFromTheMainMenu.thePage('داشبورد روزانه')),
);

Then('داشبورد روزانه به او نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureDailyBomDashboardShown()),
);

When('{actor} اجزا را از منوی اصلی باز می کند', (actor: Actor) =>
  actor.attemptsTo(OpenFromTheMainMenu.thePage('اجزا')),
);

Then('فهرست اجزا به او نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureComponentListShown()),
);
