import { Given, When, Then } from '@cucumber/cucumber';
import { Actor, actorInTheSpotlight } from '@serenity-js/core';
import {
  freshComponentInProduct,
  freshProductDetails,
  NewComponentInProduct,
  NewProductDetails,
  rememberAttempt,
  theAttempt,
  theLastRegisteredProduct,
} from '../../screenplay/bom-registration/product-details';
import {
  NewComponentDetails,
  rememberAttempt as rememberComponentAttempt,
} from '../../screenplay/bom-registration/component-details';
import {
  AttemptToRegisterProductWithNoComponents,
  EnsureNewProductWasNotRegistered,
  EnsureProductWasRegistered,
  EnterNewProductDetails,
  RegisterProduct,
  RegisterProductAndRememberIt,
} from '../../screenplay/bom-registration/register-product';
import {
  AttemptToRegisterComponentWithNoMaterials,
  DeleteAllComponentsOfProduct,
  DeleteAllMaterialsOfComponent,
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

Given('اینکه یک جز برای یک محصول در سیستم ثبت شده باشد', () =>
  actorInTheSpotlight().attemptsTo(
    RegisterProductAndRememberIt(freshProductDetails()),
  ),
);
