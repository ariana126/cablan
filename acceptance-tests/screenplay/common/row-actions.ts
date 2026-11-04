import { d, Task, Wait } from '@serenity-js/core';
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
};

export type RowAction =
  'edit' | 'delete' | 'deactivate' | 'delete-all-executions';

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
  }
};

/** Opens one row's actions menu and chooses «ویرایش», «حذف», «غیرفعال‌سازی» or «حذف همه سوابق» in it. */
export const ChooseRowAction = (record: string, action: RowAction): Task => {
  const item = menuItemFor(action);

  return Task.where(
    d`#actor chooses ${action} in the actions menu for "${record}"`,
    Wait.until(RowActions.menuButton(record), isVisible()),
    Click.on(RowActions.menuButton(record)),
    Wait.until(item, isVisible()),
    Click.on(item),
  );
};
