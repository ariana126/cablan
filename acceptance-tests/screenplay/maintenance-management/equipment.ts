import { d, Task, Wait } from '@serenity-js/core';
import { isPresent, not } from '@serenity-js/assertions';
import { Click, isVisible } from '@serenity-js/web';
import { EquipmentPage } from '../ui/equipment-page';
import { RowActions } from '../common/row-actions';
import { LocateEquipmentPage } from './maintenance-pages';
import { readEquipmentList } from './maintenance-api';
import { rememberEquipment } from './maintenance-records';
import { namedCatalog } from './named-catalog';

/**
 * The equipment vocabulary — registring-equipment.feature, and every other maintenance feature's
 * «تجهیز «…» در سیستم ثبت شده باشد». `POST/PATCH equipment`, `GET equipment` (by name, with
 * `retired`), `POST equipment/:id/retirement`; the page is `/equipment`.
 */
const catalog = namedCatalog({
  noun: 'equipment',
  resource: 'equipment',
  page: EquipmentPage,
  locatePage: LocateEquipmentPage,
  readAll: readEquipmentList,
  remember: rememberEquipment,
});

export const RegisterEquipment = catalog.Register;
export const RegisterEquipmentUnlessRegistered =
  catalog.RegisterUnlessRegistered;
export const RenameEquipment = catalog.Rename;
export const EnterNewEquipmentDetails = catalog.EnterNewDetails;
export const SubmitEquipmentLeavingTheNameEmpty =
  catalog.SubmitLeavingTheNameEmpty;
export const ClearTheEquipmentName = catalog.ClearTheName;
export const NoteTheEquipmentBeforeTheAttempt =
  catalog.NoteTheRecordsBeforeTheAttempt;
export const rememberTheEquipmentRenameTarget = catalog.rememberTheRenameTarget;
export const EnsureEquipmentIsRegistered = catalog.EnsureRegistered;
export const EnsureNoNewEquipmentWasRegistered =
  catalog.EnsureNothingNewRegistered;
export const EnsureEquipmentWasNotRenamed = catalog.EnsureNotRenamed;

export const EnsureEquipmentNameErrorShown = (): Task =>
  catalog.EnsureNameErrorShown('missing');

export const EnsureDuplicateEquipmentNameErrorShown = (): Task =>
  catalog.EnsureNameErrorShown('duplicate');

/**
 * «… تجهیز «…» را کنار می گذارد» — from the equipment's row: its actions menu, «کنار گذاشتن», and
 * the confirmation. Waits for the confirmation to close, i.e. for the site's answer.
 */
export const RetireEquipment = {
  using: (name: string): Task =>
    Task.where(
      d`#actor retires the equipment ${name}`,
      LocateEquipmentPage(),
      Wait.until(RowActions.menuButton(name), isVisible()),
      Click.on(RowActions.menuButton(name)),
      Wait.until(EquipmentPage.retireMenuItem(), isVisible()),
      Click.on(EquipmentPage.retireMenuItem()),
      Wait.until(EquipmentPage.confirmRetirementButton(), isVisible()),
      Click.on(EquipmentPage.confirmRetirementButton()),
      Wait.until(EquipmentPage.confirmRetirementButton(), not(isPresent())),
    ),
};
