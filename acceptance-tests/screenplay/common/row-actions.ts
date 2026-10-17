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
};

export type RowAction = 'edit' | 'delete';

/** Opens one row's actions menu and chooses «ویرایش» or «حذف» in it. */
export const ChooseRowAction = (record: string, action: RowAction): Task => {
  const item =
    action === 'edit' ? RowActions.editMenuItem() : RowActions.deleteMenuItem();

  return Task.where(
    d`#actor chooses ${action} in the actions menu for "${record}"`,
    Wait.until(RowActions.menuButton(record), isVisible()),
    Click.on(RowActions.menuButton(record)),
    Wait.until(item, isVisible()),
    Click.on(item),
  );
};
