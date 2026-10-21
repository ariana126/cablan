/** A value a multi-value column filter can hold: most are strings, «فعال» is a boolean. */
export type ActiveFilterValue = string | boolean;

/**
 * One chosen value of one column filter: what the strip reads, the accessible name of the button
 * that removes it, and — so the page can drop exactly that value — which field and value it stands
 * for. `filterValue` is `undefined` on the one chip a filter that matches nothing gets.
 */
export interface ActiveFilterChip {
  /** Unique across the strip; encodes field and value, so it is only ever used to track the chip. */
  readonly id: string;
  readonly filterKey: string;
  readonly filterValue: ActiveFilterValue | undefined;
  readonly column: string;
  readonly value: string;
  /** e.g. «حذف فیلتر برند: کابلان» — says which filter goes, since every chip's × looks alike. */
  readonly removeLabel: string;
}

/** One column a page lets the visitor filter by several values at once. */
export interface MultiValueFilterField<K extends string> {
  readonly key: K;
  readonly label: string;
}

/** What a chip reads for a filter whose every value was unticked — it matches no row at all. */
const NOTHING_SELECTED_LABEL = 'هیچ‌کدام';

/**
 * One chip per chosen value, field by field in the order given: «برند: کابلان» and «برند: لگراند»
 * rather than one «برند: کابلان، لگراند» — so each can be removed on its own (issue #47).
 *
 * A field left `undefined` has no filter and gets no chip. One set to `[]` (every box unticked)
 * does filter — it matches nothing — so it keeps a single «هیچ‌کدام» chip, or there would be no way
 * to see or lift it short of «پاک کردن همه».
 */
export function multiValueFilterChips<K extends string, V extends ActiveFilterValue>(
  fields: readonly MultiValueFilterField<K>[],
  selections: Partial<Record<K, readonly V[] | undefined>>,
  valueLabel: (key: K, value: V) => string,
): ActiveFilterChip[] {
  return fields.flatMap((field) => {
    const values = selections[field.key];
    if (values === undefined) {
      return [];
    }
    if (values.length === 0) {
      return [chip(field, undefined, NOTHING_SELECTED_LABEL)];
    }
    return values.map((value) => chip(field, value, valueLabel(field.key, value)));
  });
}

/**
 * `selections` with the removed chip's value taken out of its field. The last value going lifts
 * the field's filter altogether (`undefined`, the same "no filter" every page already uses), as
 * does removing the «هیچ‌کدام» chip.
 */
export function withoutFilterValue<S extends object>(selections: S, chip: ActiveFilterChip): S {
  const current = (selections as Record<string, readonly ActiveFilterValue[] | undefined>)[
    chip.filterKey
  ];
  const remaining =
    chip.filterValue === undefined
      ? []
      : (current ?? []).filter((value) => value !== chip.filterValue);
  return { ...selections, [chip.filterKey]: remaining.length > 0 ? remaining : undefined };
}

function chip<K extends string>(
  field: MultiValueFilterField<K>,
  filterValue: ActiveFilterValue | undefined,
  value: string,
): ActiveFilterChip {
  return {
    // JSON keeps a string 'true' and a boolean true apart, and no key or value can collide.
    id: JSON.stringify([field.key, filterValue ?? null]),
    filterKey: field.key,
    filterValue,
    column: field.label,
    value,
    removeLabel: `حذف فیلتر ${field.label}: ${value}`,
  };
}
