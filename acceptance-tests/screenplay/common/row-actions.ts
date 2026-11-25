import { d, Task } from '@serenity-js/core';
import { WaitUntil } from './polling';
import { By, Click, isVisible, PageElement } from '@serenity-js/web';

/**
 * The overflow menu at the end of a data-sheet row (`app-data-sheet`'s table), where edit, copy-id
 * and delete live. It is the same on every list page, so it is one helper here rather than one copy
 * per page object.
 *
 * Each row's trigger is named for its record («عملیات بیشتر برای ORD-202»). The menu is one overlay
 * at a time, so its items carry bare verbs («ویرایش», «حذف», «کپی شناسه») and are unambiguous once a
 * row's menu is open. A page whose primary row action is «ویرایش» (the master-data lists) keeps that
 * as a direct button and only sends «حذف» through the menu.
 */
export const RowActions = {
  menuButton: (record: string) =>
    PageElement.located(
      By.role('button', { name: `عملیات بیشتر برای ${record}`, exact: true }),
    ).describedAs(`actions menu button for "${record}"`),

  editMenuItem: () =>
    PageElement.located(
      By.role('menuitem', { name: 'ویرایش', exact: true }),
    ).describedAs('edit menu item'),

  deleteMenuItem: () =>
    PageElement.located(
      By.role('menuitem', { name: 'حذف', exact: true }),
    ).describedAs('delete menu item'),

  /**
   * ASSUMPTION (issue #91): «غیرفعال‌سازی» — the PM plan row's menu item that replaced «حذف» there.
   */
  deactivateMenuItem: () =>
    PageElement.located(
      By.role('menuitem', { name: 'غیرفعال\u200cسازی', exact: true }),
    ).describedAs('deactivate menu item'),

  /**
   * Issue #110, confirmed against source: «حذف همه سوابق» — the System Admin's item on a PM plan row's menu,
   * deleting every execution recorded against that row.
   */
  deleteAllExecutionsMenuItem: () =>
    PageElement.located(
      By.role('menuitem', { name: 'حذف همه سوابق', exact: true }),
    ).describedAs('delete all executions menu item'),

  /**
   * ASSUMPTION (issue #133, frontend built in parallel): «تعریف محصول مشابه» — a `/products` row's
   * menu item opening the new product form filled from that product.
   */
  createSimilarProductMenuItem: () =>
    PageElement.located(
      By.role('menuitem', { name: 'تعریف محصول مشابه', exact: true }),
    ).describedAs('create similar product menu item'),

  /**
   * ASSUMPTION (issue #133, frontend built in parallel): «تعریف آنالیز مشابه» — a `/standard-boms`
   * row's menu item opening the new standard BOM form filled from that standard BOM.
   */
  createSimilarStandardBomMenuItem: () =>
    PageElement.located(
      By.role('menuitem', { name: 'تعریف آنالیز مشابه', exact: true }),
    ).describedAs('create similar standard BOM menu item'),

  /**
   * ASSUMPTION (issue #135, frontend built in parallel): «جزئیات ویرایش» — a `/boms` row's menu item,
   * present only when its daily BOM has edit details, opening the edit-details dialog. It used to
   * be an icon button in the row's actions cell.
   */
  editDetailsMenuItem: () =>
    PageElement.located(
      By.role('menuitem', { name: 'جزئیات ویرایش', exact: true }),
    ).describedAs('edit details menu item'),
};

export type RowAction =
  | 'edit'
  | 'delete'
  | 'deactivate'
  | 'delete-all-executions'
  | 'create-similar-product'
  | 'create-similar-standard-bom'
  | 'edit-details';

const menuItemFor = (action: RowAction) => {
  switch (action) {
    case 'edit':
      return RowActions.editMenuItem();
    case 'delete':
      return RowActions.deleteMenuItem();
    case 'deactivate':
      return RowActions.deactivateMenuItem();
    case 'delete-all-executions':
      return RowActions.deleteAllExecutionsMenuItem();
    case 'create-similar-product':
      return RowActions.createSimilarProductMenuItem();
    case 'create-similar-standard-bom':
      return RowActions.createSimilarStandardBomMenuItem();
    case 'edit-details':
      return RowActions.editDetailsMenuItem();
  }
};

/** Opens one row's actions menu and chooses «ویرایش», «حذف», «غیرفعال‌سازی», «حذف همه سوابق»,
 * «تعریف محصول مشابه», «تعریف آنالیز مشابه» or «جزئیات ویرایش» in it. */
export const ChooseRowAction = (record: string, action: RowAction): Task => {
  const item = menuItemFor(action);

  return Task.where(
    d`#actor chooses ${action} in the actions menu for "${record}"`,
    WaitUntil(RowActions.menuButton(record), isVisible()),
    Click.on(RowActions.menuButton(record)),
    WaitUntil(item, isVisible()),
    Click.on(item),
  );
};
