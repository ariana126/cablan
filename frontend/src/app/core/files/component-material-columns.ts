import { XlsxCell } from './xlsx-downloader';

/** One component of a BOM, its materials in the standard BOM's own defined order. */
export interface ComponentMaterials {
  readonly name: string;
  readonly materials: readonly { readonly name: string; readonly weight: number }[];
}

export interface ComponentMaterialColumns {
  /** A (material, weight) header pair per material slot of each component, in component order. */
  readonly headers: string[];
  /** One row of cells per input BOM, aligned with `headers`; `''` where the BOM lacks that slot. */
  readonly rows: XlsxCell[][];
}

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

function toPersianDigits(value: number): string {
  return String(value).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)]);
}

/**
 * Merges every BOM's component order into one, stably: each BOM's own relative order is kept, and a
 * component first seen in a later BOM goes right after its nearest preceding component (in that
 * BOM) already placed — or, failing that, right before its nearest following one — else at the end.
 * That is what puts «مغزی» ahead of «روکش» even when the first BOM exported holds only «روکش».
 */
function mergeComponentOrder(
  componentsByItem: readonly (readonly ComponentMaterials[])[],
): string[] {
  const order: string[] = [];
  for (const components of componentsByItem) {
    const names = components.map((component) => component.name);
    names.forEach((name, index) => {
      if (order.includes(name)) {
        return;
      }
      const preceding = names
        .slice(0, index)
        .reverse()
        .find((other) => order.includes(other));
      if (preceding !== undefined) {
        order.splice(order.indexOf(preceding) + 1, 0, name);
        return;
      }
      const following = names.slice(index + 1).find((other) => order.includes(other));
      if (following !== undefined) {
        order.splice(order.indexOf(following), 0, name);
        return;
      }
      order.push(name);
    });
  }
  return order;
}

/** Every material of the named component in one BOM, in order — a component repeated under the
 * same name contributes its materials after the first one's. */
function materialsOf(components: readonly ComponentMaterials[], name: string) {
  return components.filter((component) => component.name === name).flatMap((c) => c.materials);
}

/**
 * Lays BOMs out one row each: per component, a «نوع مواد اولیه …» / «وزن …» column pair per
 * material slot, as many slots as that component has materials in any of the BOMs. Slots are
 * positional (a BOM's i-th material of the component fills slot i), and a component with more than
 * one slot numbers every one of its headers in Persian digits («مغزی ۱», «مغزی ۲»); one with a
 * single slot everywhere is left unnumbered. A BOM lacking a component or a slot leaves both cells
 * of that pair empty.
 */
export function buildComponentMaterialColumns(
  componentsByItem: readonly (readonly ComponentMaterials[])[],
): ComponentMaterialColumns {
  const layout = mergeComponentOrder(componentsByItem).map((name) => ({
    name,
    slots: Math.max(...componentsByItem.map((components) => materialsOf(components, name).length)),
  }));

  const headers = layout.flatMap(({ name, slots }) =>
    Array.from({ length: slots }, (_, index) => {
      const label = slots > 1 ? `${name} ${toPersianDigits(index + 1)}` : name;
      return [`نوع مواد اولیه ${label}`, `وزن ${label}`];
    }).flat(),
  );

  const rows = componentsByItem.map((components) =>
    layout.flatMap(({ name, slots }) => {
      const materials = materialsOf(components, name);
      return Array.from({ length: slots }, (_, index): XlsxCell[] => {
        const material = materials[index];
        return material === undefined ? ['', ''] : [material.name, material.weight];
      }).flat();
    }),
  );

  return { headers, rows };
}
