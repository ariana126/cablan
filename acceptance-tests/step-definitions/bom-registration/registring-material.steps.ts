import { Before, Given, When, Then } from '@cucumber/cucumber';
import { Actor, actorInTheSpotlight } from '@serenity-js/core';
import {
  freshMaterialDetails,
  NewMaterialDetails,
  rememberAttempt,
  theAttempt,
  theLastRegisteredMaterial,
  theMaterialRegisteredWithCode,
  theMaterialRegisteredWithName,
} from '../../screenplay/bom-registration/material-details';
import {
  AttemptToRegisterLeavingCodeEmpty,
  AttemptToRegisterLeavingNameEmpty,
  EnsureDuplicateMaterialCodeErrorShown,
  EnsureDuplicateMaterialNameErrorShown,
  EnsureMaterialCodeErrorShown,
  EnsureMaterialNameErrorShown,
  EnsureMaterialWasRegistered,
  EnsureMaterialWasStoredWith,
  EnsureNewMaterialWasNotRegistered,
  EnterNewMaterialDetails,
  RegisterMaterial,
  RegisterMaterialAndRememberIt,
} from '../../screenplay/bom-registration/register-material';
import {
  AttemptToClearMaterialCode,
  AttemptToClearMaterialName,
  EditMaterial,
  EnsureMaterialWasEditedWith,
  EnsureMaterialWasNotEdited,
} from '../../screenplay/bom-registration/edit-material';
import {
  DeleteMaterial,
  EnsureMaterialWasDeleted,
  EnsureMaterialWasNotDeleted,
} from '../../screenplay/bom-registration/delete-material';
import {
  DeleteProductNamed,
  EnsureMaterialIsGone,
  EnsureMaterialIsRegistered,
  RegisterMaterialNamed,
  RegisterProductsUsingMaterial,
  RegisterStandardBomUsing,
} from '../../screenplay/bom-registration/record-dependencies';
import { freshComponentInProduct } from '../../screenplay/bom-registration/product-details';
import {
  CorrectMaterial,
  forgetTheNotedDailyBomWeights,
  EnsureDailyBomIsStillApprovedBy,
  EnsureDailyBomUsesMaterial,
  EnsureProductUsesMaterial,
  EnsureWeightsOfDailyBomAreUnchanged,
  NoteTheWeightsOfDailyBom,
  RegisterMaterialWithCodeUnlessRegistered,
} from '../../screenplay/bom-registration/record-correction';
import {
  RegisterDailyBomOnStandardBom,
  RegisterStandardBomForProductNamed,
} from '../../screenplay/bom-registration/record-dependencies';
import { freshMiCode } from '../../screenplay/bom-registration/standard-bom-details';
import {
  approveDailyBomAsAPrecondition,
  theDailyBomWithOrderNumber,
} from '../../screenplay/bom-analyzing/daily-bom-approval';
import { performAsTheSystemAdmin } from '../../screenplay/common/observer';
import { triedThrough } from '../../screenplay/common/refusal-door-context';
import { statementsAboutMaterialsAre } from '../../screenplay/common/material-statement-context';

// The daily-BOM weights issue #110's correction example notes, so no scenario compares with
// another's.
Before(() => forgetTheNotedDailyBomWeights());

// سناریو: ثبت مواد اولیه جدید

When('{actor} مواد اولیه جدیدی با اطلاعات معتبر ثبت می کند', (actor: Actor) => {
  const details = freshMaterialDetails();
  rememberAttempt<NewMaterialDetails>(details);
  return actor.attemptsTo(RegisterMaterial.using(details));
});

Then('مواد اولیه جدیدی در سیستم ثبت شده باشد', () =>
  actorInTheSpotlight().attemptsTo(
    EnsureMaterialWasRegistered(theAttempt<NewMaterialDetails>()),
  ),
);

// سناریو: ویرایش مواد اولیه

Given('اینکه یک مواد اولیه در سیستم ثبت شده باشد', () =>
  actorInTheSpotlight().attemptsTo(
    RegisterMaterialAndRememberIt(freshMaterialDetails()),
  ),
);

When('{actor} اطلاعات آن مواد اولیه را ویرایش می کند', (actor: Actor) => {
  const target = theLastRegisteredMaterial();
  const changes: Partial<NewMaterialDetails> = {
    name: freshMaterialDetails().name,
  };
  rememberAttempt<Partial<NewMaterialDetails>>(changes);
  return actor.attemptsTo(EditMaterial.using(target.name, changes));
});

Then('اطلاعات ویرایش شده مواد اولیه در سیستم ثبت شده باشد', () =>
  actorInTheSpotlight().attemptsTo(
    EnsureMaterialWasEditedWith(theAttempt<Partial<NewMaterialDetails>>()),
  ),
);

// سناریو: حذف مواد اولیه

When('{actor} آن مواد اولیه را حذف می کند', (actor: Actor) =>
  actor.attemptsTo(DeleteMaterial.using(theLastRegisteredMaterial().name)),
);

Then('آن مواد اولیه از سیستم حذف شده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureMaterialWasDeleted()),
);

// قانون: فقط مدیریت و مدیر سیستم مجاز به ثبت، ویرایش یا حذف مواد اولیه هستند
// (پیغام خطای عدم دسترسی نشان داده شود — تعریف شده در step-definitions/common.steps.ts)

When('{actor} تلاش می کند مواد اولیه جدیدی ثبت کند', (actor: Actor) => {
  const details = freshMaterialDetails();
  rememberAttempt<NewMaterialDetails>(details);
  return actor.attemptsTo(RegisterMaterial.viaApiUsing(details));
});

Then('مواد اولیه جدیدی ثبت نشده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureNewMaterialWasNotRegistered()),
);

When(
  '{actor} تلاش می کند اطلاعات آن مواد اولیه را ویرایش کند',
  (actor: Actor) =>
    actor.attemptsTo(
      EditMaterial.viaApiUsing(theLastRegisteredMaterial().id, {
        code: theLastRegisteredMaterial().code,
        name: 'تلاش بدون دسترسی',
      }),
    ),
);

Then('مواد اولیه ویرایش نشده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureMaterialWasNotEdited()),
);

When('{actor} تلاش می کند آن مواد اولیه را حذف کند', (actor: Actor) =>
  actor.attemptsTo(DeleteMaterial.viaApiUsing(theLastRegisteredMaterial().id)),
);

Then('آن مواد اولیه از سیستم حذف نشده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureMaterialWasNotDeleted()),
);

// قانون: اسم مواد اولیه نباید خالی باشد

When('{actor} اطلاعات مواد اولیه جدید را وارد می کند', (actor: Actor) => {
  const details = freshMaterialDetails();
  rememberAttempt<NewMaterialDetails>(details);
  return actor.attemptsTo(EnterNewMaterialDetails(details));
});

When('اسم مواد اولیه را خالی می گذارد', () => {
  const changes: NewMaterialDetails = {
    ...theAttempt<NewMaterialDetails>(),
    name: '',
  };
  rememberAttempt<NewMaterialDetails>(changes);
  return actorInTheSpotlight().attemptsTo(AttemptToRegisterLeavingNameEmpty());
});

Then('پیغام خطای اسم مواد اولیه نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureMaterialNameErrorShown()),
);

When('{actor} اسم آن مواد اولیه را پاک می کند', (actor: Actor) => {
  const target = theLastRegisteredMaterial();
  rememberAttempt<Partial<NewMaterialDetails>>({ name: '' });
  return actor.attemptsTo(AttemptToClearMaterialName(target.name));
});

// قانون: اسم هر مواد اولیه باید یونیک باشد

Given(
  'اینکه مواد اولیه ای با اسم {string} در سیستم ثبت شده باشد',
  (name: string) =>
    actorInTheSpotlight().attemptsTo(
      RegisterMaterialAndRememberIt(freshMaterialDetails({ name })),
    ),
);

When(
  '{actor} مواد اولیه جدیدی با اسم {string} ثبت می کند',
  (actor: Actor, name: string) => {
    const details = freshMaterialDetails({ name });
    rememberAttempt<NewMaterialDetails>(details);
    return actor.attemptsTo(RegisterMaterial.using(details));
  },
);

Then('پیغام خطای تکراری بودن اسم مواد اولیه نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureDuplicateMaterialNameErrorShown()),
);

Given(
  'اینکه مواد اولیه ای با اسم {string} و مواد اولیه دیگری با اسم {string} در سیستم ثبت شده باشد',
  (nameA: string, nameB: string) =>
    actorInTheSpotlight().attemptsTo(
      RegisterMaterialAndRememberIt(freshMaterialDetails({ name: nameA })),
      RegisterMaterialAndRememberIt(freshMaterialDetails({ name: nameB })),
    ),
);

When(
  '{actor} اسم مواد اولیه {string} را به {string} تغییر می دهد',
  (actor: Actor, fromName: string, toName: string) => {
    const target = theMaterialRegisteredWithName(fromName);
    const changes: Partial<NewMaterialDetails> = { name: toName };
    rememberAttempt<Partial<NewMaterialDetails>>(changes);
    return actor.attemptsTo(EditMaterial.using(target.name, changes));
  },
);

// قانون: کد مواد اولیه نباید خالی باشد
// («{actor} اطلاعات مواد اولیه جدید را وارد می کند» — defined above, under the name rule)

When('کد مواد اولیه را خالی می گذارد', () => {
  const changes: NewMaterialDetails = {
    ...theAttempt<NewMaterialDetails>(),
    code: '',
  };
  rememberAttempt<NewMaterialDetails>(changes);
  return actorInTheSpotlight().attemptsTo(AttemptToRegisterLeavingCodeEmpty());
});

Then('پیغام خطای کد مواد اولیه نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureMaterialCodeErrorShown()),
);

When('{actor} کد آن مواد اولیه را پاک می کند', (actor: Actor) => {
  const target = theLastRegisteredMaterial();
  rememberAttempt<Partial<NewMaterialDetails>>({ code: '' });
  return actor.attemptsTo(AttemptToClearMaterialCode(target.name));
});

// قانون: رقم های کد و اسم مواد اولیه با رقم انگلیسی ثبت می شوند، حتی اگر با رقم فارسی وارد شوند
//
// The outline's «ثبت می کند» lines are the existing «... با کد/اسم {string} ثبت می کند» Whens (the
// form, typed as given); its «ثبت شده باشد» lines read the stored value back over HTTP.

Then('مواد اولیه جدیدی با کد {string} در سیستم ثبت شده باشد', (code: string) =>
  actorInTheSpotlight().attemptsTo(
    EnsureMaterialWasStoredWith(theAttempt<NewMaterialDetails>(), 'code', code),
  ),
);

Then('مواد اولیه جدیدی با اسم {string} در سیستم ثبت شده باشد', (name: string) =>
  actorInTheSpotlight().attemptsTo(
    EnsureMaterialWasStoredWith(theAttempt<NewMaterialDetails>(), 'name', name),
  ),
);

// قانون: کد هر مواد اولیه باید یونیک باشد
//
// «ثبت مواد اولیه با کد تکراری با رقم فارسی» reuses this rule's steps; its «ثبت نشده باشد» treats
// «M-۱۰۱» and «M-101» as one code (`register-material.ts#EnsureNewMaterialWasNotRegistered`).

Given(
  'اینکه مواد اولیه ای با کد {string} در سیستم ثبت شده باشد',
  (code: string) =>
    actorInTheSpotlight().attemptsTo(
      RegisterMaterialAndRememberIt(freshMaterialDetails({ code })),
    ),
);

When(
  '{actor} مواد اولیه جدیدی با کد {string} ثبت می کند',
  (actor: Actor, code: string) => {
    const details = freshMaterialDetails({ code });
    rememberAttempt<NewMaterialDetails>(details);
    return actor.attemptsTo(RegisterMaterial.using(details));
  },
);

Then('پیغام خطای تکراری بودن کد مواد اولیه نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureDuplicateMaterialCodeErrorShown()),
);

Given(
  'اینکه مواد اولیه ای با کد {string} و مواد اولیه دیگری با کد {string} در سیستم ثبت شده باشد',
  (codeA: string, codeB: string) =>
    actorInTheSpotlight().attemptsTo(
      RegisterMaterialAndRememberIt(freshMaterialDetails({ code: codeA })),
      RegisterMaterialAndRememberIt(freshMaterialDetails({ code: codeB })),
    ),
);

When(
  '{actor} کد مواد اولیه {string} را به {string} تغییر می دهد',
  (actor: Actor, fromCode: string, toCode: string) => {
    const target = theMaterialRegisteredWithCode(fromCode);
    const changes: Partial<NewMaterialDetails> = { code: toCode };
    rememberAttempt<Partial<NewMaterialDetails>>(changes);
    return actor.attemptsTo(EditMaterial.using(target.name, changes));
  },
);

// قانون: مواد اولیه ای که در محصول یا آنالیز استانداردی استفاده شده باشد قابل ویرایش یا حذف نیست
// (issue #94)
//
// The doors are this area's: the plain and the «تلاش …» deletions and edits drive `/materials`
// (a refusal leaves the dialog open, its alert saying where the material is used); preconditions
// and facts go through the API as the system admin, so the actor's spotlight is left alone.
// Shared with registring-component.feature, in ./common.steps.ts: «"…" در هیچ محصول یا آنالیز
// استانداردی استفاده نشده باشد», «مواد اولیه … فقط در جز … محصول … استفاده شده باشد», «برای محصول …
// هیچ آنالیز استانداردی ثبت نشده باشد», «مواد اولیه … در جز … محصول … با … جایگزین شده باشد» and
// both «به او گفته شود که … در N محصول/آنالیز استاندارد … استفاده شده است».

Given('اینکه مواد اولیه {string} در سیستم ثبت شده باشد', (name: string) =>
  performAsTheSystemAdmin(RegisterMaterialNamed(name)),
);

When(
  '{actor} مواد اولیه {string} را حذف می کند',
  (actor: Actor, name: string) => actor.attemptsTo(DeleteMaterial.using(name)),
);

Then('مواد اولیه {string} از سیستم حذف شده باشد', (name: string) =>
  performAsTheSystemAdmin(EnsureMaterialIsGone(name)),
);

Given(
  'اینکه مواد اولیه {string} فقط در محصول {string} استفاده شده باشد',
  (materialName: string, productName: string) =>
    performAsTheSystemAdmin(
      RegisterProductsUsingMaterial(materialName, [productName]),
    ),
);

Given(
  'اینکه مواد اولیه {string} در محصول {string} استفاده شده باشد',
  (materialName: string, productName: string) =>
    performAsTheSystemAdmin(
      RegisterProductsUsingMaterial(materialName, [productName]),
    ),
);

// «فقط در آنالیز استاندارد» cannot be arranged through the public API: a standard BOM clones its
// product's composition, and that product then stays — so it is a product and a standard BOM
// cloning it, and the `Then` asserts the standard-BOM entry among the dependents.
Given(
  'اینکه مواد اولیه {string} فقط در آنالیز استاندارد {string} استفاده شده باشد',
  (materialName: string, miCode: string) =>
    performAsTheSystemAdmin(
      RegisterStandardBomUsing(
        freshComponentInProduct().name,
        materialName,
        miCode,
      ),
    ),
);

// Also viewing-audit-log's issue #110 correction example, whose background already registered
// «مسی» with «M-100» (row 5) — hence «unless registered». It opens its scenario, so it owns the
// statement flag (`material-statement-context.ts`): a following «و مواد اولیه … با کد … در سیستم
// ثبت شده باشد» (the duplicate-code example) is a precondition too.
Given(
  'اینکه مواد اولیه {string} با کد {string} در محصول {string} استفاده شده باشد',
  (materialName: string, code: string, productName: string) => {
    statementsAboutMaterialsAre('precondition');
    return performAsTheSystemAdmin(
      RegisterMaterialWithCodeUnlessRegistered(materialName, code),
      RegisterProductsUsingMaterial(materialName, [productName]),
    );
  },
);

Given(
  'اینکه مواد اولیه {string} در محصولات {string} و {string} استفاده شده باشد',
  (materialName: string, first: string, second: string) =>
    performAsTheSystemAdmin(
      RegisterProductsUsingMaterial(materialName, [first, second]),
    ),
);

Given('محصول {string} حذف شده باشد', (productName: string) =>
  performAsTheSystemAdmin(DeleteProductNamed(productName)),
);

Given(
  'محصولات {string} و {string} حذف شده باشند',
  (first: string, second: string) =>
    performAsTheSystemAdmin(
      DeleteProductNamed(first),
      DeleteProductNamed(second),
    ),
);

When(
  '{actor} تلاش می کند مواد اولیه {string} را حذف کند',
  (actor: Actor, name: string) => {
    triedThrough('browser');
    return actor.attemptsTo(DeleteMaterial.using(name));
  },
);

Then('مواد اولیه {string} از سیستم حذف نشده باشد', (name: string) =>
  performAsTheSystemAdmin(EnsureMaterialIsRegistered(name)),
);

When(
  '{actor} تلاش می کند اسم مواد اولیه {string} را به {string} تغییر دهد',
  (actor: Actor, name: string, newName: string) => {
    triedThrough('browser');
    return actor.attemptsTo(EditMaterial.using(name, { name: newName }));
  },
);

When(
  '{actor} تلاش می کند کد مواد اولیه {string} را به {string} تغییر دهد',
  (actor: Actor, name: string, newCode: string) => {
    triedThrough('browser');
    return actor.attemptsTo(EditMaterial.using(name, { code: newCode }));
  },
);

Then(
  'مواد اولیه {string} با کد {string} ویرایش نشده باشد',
  (name: string, code: string) =>
    performAsTheSystemAdmin(EnsureMaterialIsRegistered(name, code)),
);

// قانون: مدیر سیستم نام و کد مواد اولیه استفاده شده را اصلاح می کند و با تایید او، اصلاح در همه اطلاعات و سوابق مرتبط آن اعمال می شود
// (issue #110)
//
// The corrections are the point — the confirmation the System Admin gives or withholds is
// something they see — so all three drive `/materials`: the edit dialog, then the correction
// confirmation it opens (`common/correction-confirmation.ts`). Preconditions and facts go through
// the API as the system admin. Each correction owns the statement flag: a following «مواد اولیه
// … با کد … در سیستم ثبت شده باشد» is an outcome (`material-statement-context.ts`). Reused: «… با
// کد … در محصول … استفاده شده باشد» and «… ویرایش نشده باشد» (above), «پیغام خطای تکراری بودن کد
// مواد اولیه نشان داده شود» (above) and «مواد اولیه … با کد … در سیستم ثبت شده باشد»
// (step-definitions/common.steps.ts).

Given(
  'اینکه مواد اولیه {string} با کد {string} در محصول {string} و آنالیز روزانه {string} استفاده شده باشد',
  (
    materialName: string,
    code: string,
    productName: string,
    orderNumber: string,
  ) => {
    statementsAboutMaterialsAre('precondition');
    const miCode = freshMiCode();
    return performAsTheSystemAdmin(
      RegisterMaterialWithCodeUnlessRegistered(materialName, code),
      RegisterProductsUsingMaterial(materialName, [productName]),
      RegisterStandardBomForProductNamed(productName, miCode),
      RegisterDailyBomOnStandardBom(orderNumber, miCode),
      NoteTheWeightsOfDailyBom(orderNumber),
    );
  },
);

Given(
  'آنالیز روزانه {string} توسط {actorName} تایید شده باشد',
  (orderNumber: string, approverName: string) =>
    approveDailyBomAsAPrecondition(
      theDailyBomWithOrderNumber(orderNumber),
      approverName,
    ),
);

When(
  '{actor} نام و کد مواد اولیه {string} را به {string} و {string} تغییر می دهد و اعمال آن در اطلاعات و سوابق مرتبط را تایید می کند',
  (actor: Actor, currentName: string, name: string, code: string) => {
    statementsAboutMaterialsAre('outcome');
    return actor.attemptsTo(CorrectMaterial.using(currentName, { name, code }));
  },
);

Then(
  'محصول {string} و آنالیز روزانه {string} مواد اولیه {string} با کد {string} را داشته باشند',
  (productName: string, orderNumber: string, name: string, code: string) =>
    performAsTheSystemAdmin(
      EnsureProductUsesMaterial(productName, name, code),
      EnsureDailyBomUsesMaterial(orderNumber, name, code),
    ),
);

Then('وزن های آنالیز روزانه {string} تغییر نکرده باشد', (orderNumber: string) =>
  performAsTheSystemAdmin(EnsureWeightsOfDailyBomAreUnchanged(orderNumber)),
);

Then(
  'آنالیز روزانه {string} همچنان توسط {actorName} تایید شده باشد',
  (orderNumber: string, approverName: string) =>
    performAsTheSystemAdmin(
      EnsureDailyBomIsStillApprovedBy(orderNumber, approverName),
    ),
);

When(
  '{actor} نام و کد مواد اولیه {string} را به {string} و {string} تغییر می دهد اما اعمال آن در اطلاعات و سوابق مرتبط را تایید نمی کند',
  (actor: Actor, currentName: string, name: string, code: string) => {
    statementsAboutMaterialsAre('outcome');
    return actor.attemptsTo(
      CorrectMaterial.withoutConfirmingUsing(currentName, { name, code }),
    );
  },
);

Then(
  'محصول {string} همچنان مواد اولیه {string} با کد {string} را داشته باشد',
  (productName: string, name: string, code: string) =>
    performAsTheSystemAdmin(EnsureProductUsesMaterial(productName, name, code)),
);

When(
  '{actor} کد مواد اولیه {string} را به {string} تغییر می دهد و اعمال آن در اطلاعات و سوابق مرتبط را تایید می کند',
  (actor: Actor, currentName: string, code: string) => {
    statementsAboutMaterialsAre('outcome');
    return actor.attemptsTo(
      CorrectMaterial.evenIfRefusedUsing(currentName, { code }),
    );
  },
);
