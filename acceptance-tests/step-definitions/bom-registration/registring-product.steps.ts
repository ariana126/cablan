import { Given, When, Then } from '@cucumber/cucumber';
import { Actor, actorInTheSpotlight, Task } from '@serenity-js/core';
import {
  freshComponentInProduct,
  freshMaterialInComponent,
  freshProductDetails,
  NewComponentInProduct,
  NewProductDetails,
  rememberAttempt,
  theAttempt,
  theLastRegisteredProduct,
  theProductRegisteredWithName,
} from '../../screenplay/bom-registration/product-details';
import {
  freshComponentDetails,
  NewComponentDetails,
  rememberAttempt as rememberComponentAttempt,
  theLastRegisteredComponent,
} from '../../screenplay/bom-registration/component-details';
import { RegisterComponentAndRememberIt } from '../../screenplay/bom-registration/register-component';
import {
  freshMaterialDetails,
  theLastRegisteredMaterial,
} from '../../screenplay/bom-registration/material-details';
import { RegisterMaterialAndRememberIt } from '../../screenplay/bom-registration/register-material';
import {
  AttemptToRegisterProductWithNoComponents,
  AttemptToRegisterProductWithUnregisteredComposition,
  EnsureComponentAndMaterialAreShownInSelectionLists,
  EnsureComponentNotRegisteredErrorShown,
  EnsureMaterialNotRegisteredErrorShown,
  EnsureNewProductWasNotRegistered,
  EnsureProductWasRegistered,
  EnsureProductWasStoredWithName,
  EnterNewProductDetails,
  OpenNewProductFormRevealingComponentAndMaterialPickers,
  RegisterProduct,
  RegisterProductAndRememberIt,
  RegisterProductUnlessRegistered,
} from '../../screenplay/bom-registration/register-product';
import {
  AttemptToRegisterComponentWithNoMaterials,
  DeleteAllComponentsOfProduct,
  DeleteAllMaterialsOfComponent,
  ChangeProductComposition,
  EditProduct,
  EnsureAllRegisteredComponentsBelongToProduct,
  EnsureProductWasEditedWith,
  EnsureProductWasNotEdited,
  RegisterComponentForProduct,
  RegisterMultipleComponentsForProduct,
} from '../../screenplay/bom-registration/edit-product';
import {
  DeleteProduct,
  EnsureProductWasDeleted,
  EnsureProductWasNotDeleted,
} from '../../screenplay/bom-registration/delete-product';
import {
  EnsureAtLeastOneComponentErrorShown,
  EnsureAtLeastOneMaterialErrorShown,
} from '../../screenplay/bom-registration/products-form';
import {
  EnsureComponentIsRegistered,
  EnsureCompositionOfProductIsUnchanged,
  EnsureMaterialIsRegistered,
  EnsureProductIsGone,
  EnsureProductIsRegistered,
  EnsureStandardBomIsRegistered,
  NoteTheCompositionOfProduct,
  RegisterDailyBomOnStandardBom,
  RegisterProductComposedOf,
  RegisterStandardBomForProduct,
} from '../../screenplay/bom-registration/record-dependencies';
import {
  CorrectProduct,
  EnsureStandardAndDailyBomBelongToProduct,
} from '../../screenplay/bom-registration/record-correction';
import {
  componentOrderFrom,
  EnsureComponentOfProductHoldsMaterial,
  EnsureComponentOrderOfDailyBom,
  EnsureComponentOrderOfProduct,
  EnsureComponentOrderOfStandardBom,
  RegisterProductWithComponentsInOrder,
  ReorderAndAddComponent,
  ReorderProductComponents,
} from '../../screenplay/bom-registration/component-order';
import { performAsTheSystemAdmin } from '../../screenplay/common/observer';
import {
  freshBrand,
  freshStandardLength,
  NewStandardBomDetails,
  rememberAttempt as rememberStandardBomAttempt,
} from '../../screenplay/bom-registration/standard-bom-details';
import { RegisterStandardBom } from '../../screenplay/bom-registration/register-standard-bom';
import { triedThrough } from '../../screenplay/common/refusal-door-context';
import { setCurrentComponentOwner } from '../../screenplay/common/composition-context';
import {
  AcceptTheStandardBomOffer,
  CancelTheStandardBomForm,
  DeclineTheStandardBomOffer,
  EnsureNoStandardBomIsOffered,
  EnsureProductIsStoredAsRegistered,
  EnsureStandardBomIsRegisteredFor,
  EnsureTheProductOfTheStandardBomFormIsLocked,
  EnsureTheStandardBomFormIsOpenFor,
  EnsureTheStandardBomOfferAsks,
  RegisterStandardBomInTheOfferedForm,
} from '../../screenplay/bom-registration/standard-bom-offer';

// سناریو: ثبت محصول جدید

When('{actor} محصول جدیدی با اطلاعات معتبر ثبت می کند', (actor: Actor) => {
  const details = freshProductDetails();
  rememberAttempt<NewProductDetails>(details);
  return actor.attemptsTo(RegisterProduct.using(details));
});

Then('محصول جدیدی در سیستم ثبت شده باشد', () =>
  actorInTheSpotlight().attemptsTo(
    EnsureProductWasRegistered(theAttempt<NewProductDetails>()),
  ),
);

// سناریو: ویرایش محصول
//
// This Given also backs "قانون: هر محصول حداقل یک جز دارد"'s "یک محصول با حداقل یک جز" wording,
// "قانون: هر جز حداقل یک مواد اولیه دارد"'s "یک جز با حداقل یک مواد اولیه"/"یک جز برای یک محصول"
// wording below, and "قانون: یک محصول می تواند بیش از یک جز داشته باشد" — every one of those is the
// same underlying fact (`freshProductDetails()` always creates exactly one component, itself
// carrying exactly one material), and `RegisterProductAndRememberIt` always remembers both the
// product and that component (`register-product.ts`'s own comment explains why).

Given('اینکه یک محصول در سیستم ثبت شده باشد', () =>
  actorInTheSpotlight().attemptsTo(
    RegisterProductAndRememberIt(freshProductDetails()),
  ),
);

When('{actor} اطلاعات آن محصول را ویرایش می کند', (actor: Actor) => {
  const target = theLastRegisteredProduct();
  const changes: Partial<NewProductDetails> = {
    name: freshProductDetails().name,
  };
  rememberAttempt<Partial<NewProductDetails>>(changes);
  return actor.attemptsTo(EditProduct.using(target.name, changes));
});

Then('اطلاعات ویرایش شده محصول در سیستم ثبت شده باشد', () =>
  actorInTheSpotlight().attemptsTo(
    EnsureProductWasEditedWith(theAttempt<Partial<NewProductDetails>>()),
  ),
);

// سناریو: حذف محصول

When('{actor} آن محصول را حذف می کند', (actor: Actor) =>
  actor.attemptsTo(DeleteProduct.using(theLastRegisteredProduct().name)),
);

Then('آن محصول از سیستم حذف شده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureProductWasDeleted()),
);

// قانون: فقط مدیریت و مدیر سیستم مجاز به ثبت، ویرایش یا حذف محصول هستند
// (پیغام خطای عدم دسترسی نشان داده شود — تعریف شده در step-definitions/common.steps.ts)

When('{actor} تلاش می کند محصول جدیدی ثبت کند', (actor: Actor) => {
  const details = freshProductDetails();
  rememberAttempt<NewProductDetails>(details);
  return actor.attemptsTo(RegisterProduct.viaApiUsing(details));
});

Then('محصول جدیدی ثبت نشده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureNewProductWasNotRegistered()),
);

When('{actor} تلاش می کند اطلاعات آن محصول را ویرایش کند', (actor: Actor) =>
  actor.attemptsTo(
    EditProduct.viaApiUsing(theLastRegisteredProduct().id, {
      name: 'تلاش بدون دسترسی',
    }),
  ),
);

// Also covers "قانون: هر محصول حداقل یک جز دارد"'s "حذف تمام اجزای محصول" example below — same
// text, same file, no ambiguity risk (unlike the cross-file "جز ویرایش نشده باشد"/"جز جدیدی ثبت
// نشده باشد" steps shared with registring-component.feature via common.steps.ts).
Then('محصول ویرایش نشده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureProductWasNotEdited()),
);

When('{actor} تلاش می کند آن محصول را حذف کند', (actor: Actor) =>
  actor.attemptsTo(DeleteProduct.viaApiUsing(theLastRegisteredProduct().id)),
);

Then('آن محصول از سیستم حذف نشده باشد', () =>
  actorInTheSpotlight().attemptsTo(EnsureProductWasNotDeleted()),
);

// قانون: هر محصول حداقل یک جز دارد

When('{actor} اطلاعات محصول جدید را وارد می کند', (actor: Actor) => {
  const details = freshProductDetails({ components: [] });
  rememberAttempt<NewProductDetails>(details);
  return actor.attemptsTo(EnterNewProductDetails(details));
});

When('هیچ جزئی برای محصول ثبت نمی کند', () =>
  actorInTheSpotlight().attemptsTo(AttemptToRegisterProductWithNoComponents()),
);

Then('پیغام خطای حداقل یک جز برای محصول نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureAtLeastOneComponentErrorShown()),
);

Given('اینکه یک محصول با حداقل یک جز در سیستم ثبت شده باشد', () =>
  actorInTheSpotlight().attemptsTo(
    RegisterProductAndRememberIt(freshProductDetails()),
  ),
);

When('{actor} تمام اجزای آن محصول را حذف می کند', (actor: Actor) =>
  actor.attemptsTo(
    DeleteAllComponentsOfProduct(theLastRegisteredProduct().name),
  ),
);

// قانون: هر جز حداقل یک مواد اولیه دارد

When('{actor} جز جدیدی برای آن محصول ثبت می کند', (actor: Actor) => {
  const product = theLastRegisteredProduct();
  const details = freshComponentInProduct({ materials: [] });
  rememberAttempt<NewComponentInProduct>(details);
  rememberComponentAttempt<NewComponentDetails>({ name: details.name });
  return actor.attemptsTo(RegisterComponentForProduct(product.name, details));
});

When('هیچ مواد اولیه ای برای جز ثبت نمی کند', () =>
  actorInTheSpotlight().attemptsTo(AttemptToRegisterComponentWithNoMaterials()),
);

// 'جز جدیدی ثبت نشده باشد' is defined once, in step-definitions/bom-registration/common.steps.ts,
// shared with registring-component.feature.

Then('پیغام خطای حداقل یک مواد اولیه برای جز نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureAtLeastOneMaterialErrorShown()),
);

Given('اینکه یک جز با حداقل یک مواد اولیه در سیستم ثبت شده باشد', () =>
  actorInTheSpotlight().attemptsTo(
    RegisterProductAndRememberIt(freshProductDetails()),
  ),
);

When('{actor} تمام مواد اولیه آن جز را حذف می کند', (actor: Actor) =>
  actor.attemptsTo(
    DeleteAllMaterialsOfComponent(theLastRegisteredProduct().name),
  ),
);

// 'جز ویرایش نشده باشد' is defined once, in step-definitions/bom-registration/common.steps.ts,
// shared with registring-component.feature.

// قانون: یک محصول می تواند بیش از یک جز داشته باشد

When('{actor} چند جز برای آن محصول ثبت می کند', (actor: Actor) => {
  const product = theLastRegisteredProduct();
  const components = [freshComponentInProduct(), freshComponentInProduct()];
  rememberAttempt<NewComponentInProduct[]>(components);
  return actor.attemptsTo(
    RegisterMultipleComponentsForProduct(product.name, components),
  );
});

Then('تمام اجزای ثبت شده به محصول مربوط باشند', () =>
  actorInTheSpotlight().attemptsTo(
    EnsureAllRegisteredComponentsBelongToProduct(
      theAttempt<NewComponentInProduct[]>().map((component) => component.name),
    ),
  ),
);

// قانون: یک جز می تواند بیش از یک مواد اولیه داشته باشد
//
// The When ("{actor} چند مواد اولیه برای آن جز ثبت می کند") and its Then ("تمام مواد اولیه ثبت شده
// به جز مربوط باشند") are defined in step-definitions/bom-registration/common.steps.ts per this
// feature's dispatch — see the comment there.

Given('اینکه یک جز برای یک محصول در سیستم ثبت شده باشد', () => {
  // Sets the shared "چند مواد اولیه برای آن جز ثبت می کند" step's owner back to "product" — see
  // screenplay/common/composition-context.ts's own comment for why this is needed at all: the same
  // step text is reused, byte-for-byte, by registring-standard-bom.feature's own equivalent rule.
  setCurrentComponentOwner('product');
  return actorInTheSpotlight().attemptsTo(
    RegisterProductAndRememberIt(freshProductDetails()),
  );
});

// سناریو: نمایش فهرست اجزا و مواد اولیه ثبت‌شده هنگام ثبت محصول

Given('اینکه یک جز و یک مواد اولیه در سیستم ثبت شده باشند', () =>
  actorInTheSpotlight().attemptsTo(
    RegisterComponentAndRememberIt(freshComponentDetails()),
    RegisterMaterialAndRememberIt(freshMaterialDetails()),
  ),
);

When('{actor} فرم ثبت محصول جدید را باز می کند', (actor: Actor) =>
  actor.attemptsTo(OpenNewProductFormRevealingComponentAndMaterialPickers()),
);

Then('آن جز و آن مواد اولیه در فهرست انتخاب نشان داده شوند', () =>
  actorInTheSpotlight().attemptsTo(
    EnsureComponentAndMaterialAreShownInSelectionLists(
      theLastRegisteredComponent().name,
      theLastRegisteredMaterial().name,
    ),
  ),
);

// قانون: اجزا و مواد اولیه استفاده‌شده در محصول باید از قبل در سیستم ثبت شده باشند
//
// Both examples drive the API directly: a `mat-select` structurally cannot offer a name that isn't
// already registered (`frontend/src/app/features/products/product-form-dialog.ts`'s own class-level
// comment), so there is no screen through which a visitor could even attempt this — the same
// "active step, no screen as the point, API door" exception this suite's CLAUDE.md documents for the
// old NMK-era password-reset request. `'محصول جدیدی ثبت نشده باشد'` above already covers this rule's
// own negative assertion (door-agnostic, re-queries the product list).

Given('اینکه مواد اولیه‌ای در سیستم ثبت شده باشد', () =>
  actorInTheSpotlight().attemptsTo(
    RegisterMaterialAndRememberIt(freshMaterialDetails()),
  ),
);

When(
  '{actor} محصول جدیدی را با جزی که ثبت نشده است ثبت می کند',
  (actor: Actor) => {
    const details = freshProductDetails({
      components: [
        freshComponentInProduct({
          materials: [
            {
              name: theLastRegisteredMaterial().name,
              code: theLastRegisteredMaterial().code,
            },
          ],
        }),
      ],
    });
    rememberAttempt<NewProductDetails>(details);
    return actor.attemptsTo(
      AttemptToRegisterProductWithUnregisteredComposition(details),
    );
  },
);

Then('پیغام خطای ثبت‌نشده بودن جز نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureComponentNotRegisteredErrorShown()),
);

When(
  '{actor} محصول جدیدی را با مواد اولیه‌ای که ثبت نشده است برای آن جز ثبت می کند',
  (actor: Actor) => {
    const component = theLastRegisteredComponent();
    const details = freshProductDetails({
      components: [
        freshComponentInProduct({
          name: component.name,
          materials: [freshMaterialInComponent()],
        }),
      ],
    });
    rememberAttempt<NewProductDetails>(details);
    return actor.attemptsTo(
      AttemptToRegisterProductWithUnregisteredComposition(details),
    );
  },
);

Then('پیغام خطای ثبت‌نشده بودن مواد اولیه نشان داده شود', () =>
  actorInTheSpotlight().attemptsTo(EnsureMaterialNotRegisteredErrorShown()),
);

// قانون: رقم های نام محصول با رقم انگلیسی ثبت می شوند، حتی اگر با رقم فارسی وارد شوند
//
// The When is active, so the form, typed as given («کابل برق NYY ۳x۲.۵»); the Then reads the
// stored name back over HTTP («کابل برق NYY 3x2.5»), so it proves what the system kept rather than
// what was typed.

When(
  '{actor} محصول جدیدی با نام {string} ثبت می کند',
  (actor: Actor, name: string) => {
    const details = freshProductDetails({ name });
    rememberAttempt<NewProductDetails>(details);
    return actor.attemptsTo(RegisterProduct.using(details));
  },
);

Then('محصول جدیدی با نام {string} در سیستم ثبت شده باشد', (name: string) =>
  actorInTheSpotlight().attemptsTo(EnsureProductWasStoredWithName(name)),
);

// قانون: محصولی که آنالیز استاندارد دارد قابل حذف یا ویرایش نیست و ترکیب آن قفل است (issue #94)
//
// The deletion, the rename and the three composition changes drive `/products` (a refusal leaves
// the dialog open, its alert saying where the product is used); preconditions and facts go through
// the API as the system admin. «به او گفته شود که … در N آنالیز استاندارد … استفاده شده است» and
// «برای محصول … هیچ آنالیز استانداردی ثبت نشده باشد» live in ./common.steps.ts.

const standardBomForProduct = (miCode: string, productName: string) =>
  performAsTheSystemAdmin(RegisterStandardBomForProduct(miCode, productName));

Given(
  'اینکه آنالیز استاندارد {string} برای محصول {string} ثبت شده باشد',
  standardBomForProduct,
);

Given(
  'آنالیز استاندارد {string} برای محصول {string} ثبت شده باشد',
  standardBomForProduct,
);

Given(
  'اینکه محصول {string} با جز {string} از مواد اولیه {string} در سیستم ثبت شده باشد',
  (productName: string, componentName: string, materialName: string) =>
    performAsTheSystemAdmin(
      RegisterProductComposedOf(productName, componentName, materialName),
    ),
);

When(
  '{actor} تلاش می کند محصول {string} را حذف کند',
  (actor: Actor, name: string) => {
    triedThrough('browser');
    return actor.attemptsTo(DeleteProduct.using(name));
  },
);

Then('محصول {string} از سیستم حذف نشده باشد', (name: string) =>
  performAsTheSystemAdmin(EnsureProductIsRegistered(name)),
);

When(
  '{actor} تلاش می کند نام محصول {string} را به {string} تغییر دهد',
  (actor: Actor, name: string, newName: string) => {
    triedThrough('browser');
    return actor.attemptsTo(EditProduct.using(name, { name: newName }));
  },
);

Then('محصول {string} ویرایش نشده باشد', (name: string) =>
  performAsTheSystemAdmin(EnsureProductIsRegistered(name)),
);

/** A composition change attempt: the composition noted first, then changed through the form. */
const triesToChangeTheComposition = async (
  actor: Actor,
  productName: string,
  change: Task,
) => {
  await performAsTheSystemAdmin(NoteTheCompositionOfProduct(productName));
  triedThrough('browser');
  return actor.attemptsTo(change);
};

When(
  '{actor} تلاش می کند جز {string} را به محصول {string} اضافه کند',
  (actor: Actor, componentName: string, productName: string) =>
    triesToChangeTheComposition(
      actor,
      productName,
      ChangeProductComposition.byAddingComponent(productName, {
        name: componentName,
        materials: [freshMaterialInComponent()],
      }),
    ),
);

When(
  '{actor} تلاش می کند مواد اولیه {string} را به جز {string} محصول {string} اضافه کند',
  (
    actor: Actor,
    materialName: string,
    componentName: string,
    productName: string,
  ) =>
    triesToChangeTheComposition(
      actor,
      productName,
      ChangeProductComposition.byAddingMaterialToComponent(
        productName,
        componentName,
        freshMaterialInComponent({ name: materialName }),
      ),
    ),
);

When(
  '{actor} تلاش می کند مواد اولیه {string} را در جز {string} محصول {string} با {string} جایگزین کند',
  (
    actor: Actor,
    materialName: string,
    componentName: string,
    productName: string,
    replacementName: string,
  ) =>
    triesToChangeTheComposition(
      actor,
      productName,
      ChangeProductComposition.byReplacingMaterialOfComponent(
        productName,
        componentName,
        materialName,
        freshMaterialInComponent({ name: replacementName }),
      ),
    ),
);

Then('ترکیب محصول {string} تغییر نکرده باشد', (productName: string) =>
  performAsTheSystemAdmin(EnsureCompositionOfProductIsUnchanged(productName)),
);

// قانون: حذف یک محصول، اطلاعاتی را که محصول از آن ها استفاده کرده حذف نمی کند

When('{actor} محصول {string} را حذف می کند', (actor: Actor, name: string) =>
  actor.attemptsTo(DeleteProduct.using(name)),
);

Then('محصول {string} از سیستم حذف شده باشد', (name: string) =>
  performAsTheSystemAdmin(EnsureProductIsGone(name)),
);

Then(
  'جز {string} و مواد اولیه {string} همچنان در سیستم ثبت شده باشند',
  (componentName: string, materialName: string) =>
    performAsTheSystemAdmin(
      EnsureComponentIsRegistered(componentName),
      EnsureMaterialIsRegistered(materialName),
    ),
);

// قانون: مدیر سیستم نام محصولی را که آنالیز استاندارد دارد اصلاح می کند و اصلاح در همه اطلاعات و سوابق مرتبط آن اعمال می شود
// (issue #110)
//
// The correction drives `/products` — the edit dialog, then the correction confirmation it opens
// (`common/correction-confirmation.ts`); preconditions and facts go through the API as the system
// admin. «آنالیز استاندارد … برای محصول … ثبت شده باشد» is above.

Given(
  'آنالیز روزانه {string} بر اساس آنالیز استاندارد {string} ثبت شده باشد',
  (orderNumber: string, miCode: string) =>
    performAsTheSystemAdmin(RegisterDailyBomOnStandardBom(orderNumber, miCode)),
);

When(
  '{actor} نام محصول {string} را به {string} تغییر می دهد و اعمال آن در اطلاعات و سوابق مرتبط را تایید می کند',
  (actor: Actor, currentName: string, newName: string) =>
    actor.attemptsTo(CorrectProduct.using(currentName, newName)),
);

Then('محصول {string} در سیستم ثبت شده باشد', (name: string) =>
  performAsTheSystemAdmin(EnsureProductIsRegistered(name)),
);

Then(
  'آنالیز استاندارد {string} و آنالیز روزانه {string} مربوط به محصول {string} باشند',
  (miCode: string, orderNumber: string, productName: string) =>
    performAsTheSystemAdmin(
      EnsureStandardAndDailyBomBelongToProduct(
        miCode,
        orderNumber,
        productName,
      ),
    ),
);

// Issue #122 — the order of a product's components.
//
// UI for the active registration, the reorders and the combined reorder-and-add attempt (the edit
// dialog's «انتقال … به بالا / به پایین» buttons; that refusal is read from the dialog's alert, like
// issue #94's attempts above). API for the access-denied attempt (403), every precondition and every
// fact, read as یاشار so the actor's last response survives. «آنالیز استاندارد … برای محصول … ثبت
// شده باشد» and «آنالیز روزانه … بر اساس آنالیز استاندارد …» are above; they reuse the product a «…
// با ترتیب اجزای …» precondition registered. That precondition also serves viewing-audit-log's
// reorder event.

const registeredWithComponentsInOrder = (productName: string, order: string) =>
  performAsTheSystemAdmin(
    RegisterProductWithComponentsInOrder(
      productName,
      componentOrderFrom(order).map((name) => ({ name })),
    ),
  );

Given(
  'اینکه محصول {string} با ترتیب اجزای {string} در سیستم ثبت شده باشد',
  registeredWithComponentsInOrder,
);

Given(
  'محصول {string} با ترتیب اجزای {string} در سیستم ثبت شده باشد',
  registeredWithComponentsInOrder,
);

Given(
  'اینکه محصول {string} با ترتیب اجزای {string} از مواد اولیه {string}، {string} از مواد اولیه {string} و {string} از مواد اولیه {string} در سیستم ثبت شده باشد',
  (
    productName: string,
    firstComponent: string,
    firstMaterial: string,
    secondComponent: string,
    secondMaterial: string,
    thirdComponent: string,
    thirdMaterial: string,
  ) =>
    performAsTheSystemAdmin(
      RegisterProductWithComponentsInOrder(productName, [
        { name: firstComponent, material: firstMaterial },
        { name: secondComponent, material: secondMaterial },
        { name: thirdComponent, material: thirdMaterial },
      ]),
    ),
);

When(
  '{actor} محصول {string} را با اجزای {string}، {string} و {string} به همین ترتیب ثبت می کند',
  (
    actor: Actor,
    productName: string,
    first: string,
    second: string,
    third: string,
  ) =>
    actor.attemptsTo(
      RegisterProduct.using(
        freshProductDetails({
          name: productName,
          components: [first, second, third].map((name) =>
            freshComponentInProduct({ name }),
          ),
        }),
      ),
    ),
);

When(
  '{actor} ترتیب اجزای محصول {string} را به {string} تغییر می دهد',
  (actor: Actor, productName: string, order: string) =>
    actor.attemptsTo(
      ReorderProductComponents.using(productName, componentOrderFrom(order)),
    ),
);

When(
  '{actor} تلاش می کند ترتیب اجزای محصول {string} را به {string} تغییر دهد',
  (actor: Actor, productName: string, order: string) =>
    actor.attemptsTo(
      ReorderProductComponents.viaApiUsing(
        productName,
        componentOrderFrom(order),
      ),
    ),
);

When(
  '{actor} تلاش می کند در یک ویرایش ترتیب اجزای محصول {string} را به {string} تغییر دهد و جز {string} را به آن اضافه کند',
  (actor: Actor, productName: string, order: string, componentName: string) =>
    triesToChangeTheComposition(
      actor,
      productName,
      ReorderAndAddComponent(
        productName,
        componentOrderFrom(order),
        freshComponentInProduct({ name: componentName }),
      ),
    ),
);

Then(
  'ترتیب اجزای محصول {string} {string} باشد',
  (productName: string, order: string) =>
    performAsTheSystemAdmin(
      EnsureComponentOrderOfProduct(productName, componentOrderFrom(order)),
    ),
);

Then(
  'مواد اولیه {string} در جز {string} و مواد اولیه {string} در جز {string} محصول {string} باشند',
  (
    firstMaterial: string,
    firstComponent: string,
    secondMaterial: string,
    secondComponent: string,
    productName: string,
  ) =>
    performAsTheSystemAdmin(
      EnsureComponentOfProductHoldsMaterial(
        productName,
        firstComponent,
        firstMaterial,
      ),
      EnsureComponentOfProductHoldsMaterial(
        productName,
        secondComponent,
        secondMaterial,
      ),
    ),
);

Then(
  'ترتیب اجزای آنالیز استاندارد {string} {string} باشد',
  (miCode: string, order: string) =>
    performAsTheSystemAdmin(
      EnsureComponentOrderOfStandardBom(miCode, componentOrderFrom(order)),
    ),
);

Then(
  'ترتیب اجزای آنالیز روزانه {string} {string} باشد',
  (orderNumber: string, order: string) =>
    performAsTheSystemAdmin(
      EnsureComponentOrderOfDailyBom(orderNumber, componentOrderFrom(order)),
    ),
);

// قانون: پس از ثبت موفق محصول جدید، تعریف آنالیز استاندارد همان محصول به کاربر پیشنهاد می شود
// (issue #128)
//
// **UI throughout** for the actions — the offer exists only in the browser: the products page's new
// product form, then the offer dialog, then (accepted) the standard BOM form with the product
// locked. Facts about the system — the product, its standard BOMs — are read over the API as یاشار.
// «محصول جدیدی ثبت نشده باشد», «اینکه یک محصول در سیستم ثبت شده باشد» and «{actor} اطلاعات آن
// محصول را ویرایش می کند» are this file's earlier steps; «برای محصول … هیچ آنالیز استانداردی ثبت
// نشده باشد» lives in ./common.steps.ts.

When(
  '{actor} محصول جدید {string} را ثبت می کند',
  (actor: Actor, name: string) => {
    const details = freshProductDetails({ name });
    rememberAttempt<NewProductDetails>(details);
    return actor.attemptsTo(
      RegisterProduct.leavingTheStandardBomOfferOpen(details),
    );
  },
);

Then('از او پرسیده شود {string}', (question: string) =>
  actorInTheSpotlight().attemptsTo(EnsureTheStandardBomOfferAsks(question)),
);

When('پیشنهاد تعریف آنالیز استاندارد را می پذیرد', () =>
  actorInTheSpotlight().attemptsTo(AcceptTheStandardBomOffer()),
);

When('پیشنهاد تعریف آنالیز استاندارد را رد می کند', () =>
  actorInTheSpotlight().attemptsTo(DeclineTheStandardBomOffer()),
);

Then(
  'فرم ثبت آنالیز استاندارد برای محصول {string} باز شود',
  (productName: string) =>
    actorInTheSpotlight().attemptsTo(
      EnsureTheStandardBomFormIsOpenFor(productName),
    ),
);

Then('محصول آن فرم قابل تغییر نباشد', () =>
  actorInTheSpotlight().attemptsTo(
    EnsureTheProductOfTheStandardBomFormIsLocked(),
  ),
);

When('آنالیز استاندارد {string} را در آن فرم ثبت می کند', (miCode: string) => {
  return actorInTheSpotlight().attemptsTo(
    RegisterStandardBomInTheOfferedForm(
      miCode,
      theAttempt<NewProductDetails>().name,
    ),
  );
});

When('بدون ذخیره از فرم ثبت آنالیز استاندارد انصراف می دهد', () =>
  actorInTheSpotlight().attemptsTo(CancelTheStandardBomForm()),
);

Then('محصول {string} بدون تغییر در سیستم ثبت شده باشد', (_name: string) =>
  performAsTheSystemAdmin(
    EnsureProductIsStoredAsRegistered(theAttempt<NewProductDetails>()),
  ),
);

When(
  '{actor} تلاش می کند محصول جدید {string} را بدون هیچ جزئی ثبت کند',
  (actor: Actor, name: string) => {
    const details = freshProductDetails({ name, components: [] });
    rememberAttempt<NewProductDetails>(details);
    return actor.attemptsTo(
      EnterNewProductDetails(details),
      AttemptToRegisterProductWithNoComponents(),
    );
  },
);

Then('تعریف آنالیز استاندارد به او پیشنهاد نشود', () =>
  actorInTheSpotlight().attemptsTo(EnsureNoStandardBomIsOffered()),
);

Then(
  'آنالیز استاندارد {string} در سیستم ثبت شده باشد و به محصول {string} تعلق داشته باشد',
  (miCode: string, productName: string) =>
    performAsTheSystemAdmin(
      EnsureStandardBomIsRegisteredFor(miCode, productName),
    ),
);

// قانون: فقط مدیریت، مدیر کارخانه و مدیر سیستم مجاز به ثبت … محصول، جز، مواد اولیه و آنالیز
// استاندارد … هستند — «ثبت اطلاعات پایه توسط مدیر کارخانه» (issue #130)
//
// Active, so the browser, like every other registration of base data by its owner. The component,
// material and product rows reuse their features' own steps («… جز جدیدی با اسم … ثبت می کند»,
// «… مواد اولیه جدیدی با اسم … ثبت می کند», «… محصول جدید … را ثبت می کند» and their outcomes).
// The standard-BOM row names a product no step registered: a standard BOM is always *for* a
// product, so the step makes it true first, as the system admin over the API (as a daily-BOM
// registration defines its order first), then drives `/standard-boms`' form. Facts are read over
// the API as the system admin.

Then('مواد اولیه {string} در سیستم ثبت شده باشد', (name: string) =>
  performAsTheSystemAdmin(EnsureMaterialIsRegistered(name)),
);

When(
  '{actor} آنالیز استانداردی با کد MI {string} برای محصول {string} ثبت می کند',
  async (actor: Actor, miCode: string, productName: string) => {
    await performAsTheSystemAdmin(
      RegisterProductUnlessRegistered(
        freshProductDetails({ name: productName }),
      ),
    );
    const product = theProductRegisteredWithName(productName);
    const details: NewStandardBomDetails = {
      productId: product.id,
      productName: product.name,
      miCode,
      brand: freshBrand(),
      standardLength: freshStandardLength(),
      active: true,
      components: [],
    };
    rememberStandardBomAttempt<NewStandardBomDetails>(details);
    return actor.attemptsTo(RegisterStandardBom.using(product, details));
  },
);

Then('آنالیز استاندارد {string} در سیستم ثبت شده باشد', (miCode: string) =>
  performAsTheSystemAdmin(EnsureStandardBomIsRegistered(miCode)),
);
