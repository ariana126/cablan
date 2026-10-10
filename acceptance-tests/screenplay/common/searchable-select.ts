import { Answerable, d, Task, Wait } from '@serenity-js/core';
import { Click, Enter, isVisible, PageElement } from '@serenity-js/web';

/**
 * Picks one option from a searchable picker — the frontend's `app-searchable-select`, a
 * `mat-autocomplete` whose text box is a labelled `combobox`. Unlike a `mat-select` it is not
 * opened by a click: the visitor types to narrow the list and then clicks the option. Typing is
 * also what makes this robust — the outlined field's `mat-label` can sit over the box and
 * intercept a pointer click on it, whereas entering text focuses the box directly.
 *
 * `searchText` is what gets typed; `option` locates the entry to click (the caller knows how that
 * option is named, e.g. exactly by role/name, or by a containing text for composite labels).
 */
export const ChooseFromSearchableSelect = (
  field: Answerable<PageElement>,
  searchText: string,
  option: Answerable<PageElement>,
): Task =>
  Task.where(
    d`#actor searches for "${searchText}" and chooses it`,
    Enter.theValue(searchText).into(field),
    Wait.until(option, isVisible()),
    Click.on(option),
  );
