import { AuditChange } from '@audit-logging/application/service/audit-log.repository';

/**
 * How a `Registered`/`Deleted` entry shows *what* was registered or removed,
 * and how an `Edited` entry shows a composition replaced wholesale — the one
 * place every `@DomainEventHandler` in `application/event-handlers/**` turns a
 * domain event's plain-data snapshot into `AuditChange` lines, so the
 * representation is identical across all six record types. See
 * src/modules/audit-logging/CLAUDE.md, "What an entry's changes contain".
 *
 * Values are always strings, as everywhere else in this module: a number
 * reads as its decimal form and a boolean as `'true'`/`'false'` (the same
 * rendering `ManufacturingInstructionEdited` already uses for `active`). A field with no
 * value (`null`, `undefined` or `''`) is left out rather than shown as an
 * empty-to-empty line.
 */
export type AuditFieldValue = string | number | boolean | null | undefined;

// Structural on purpose: products' materials carry no weight, standard BOMs'
// and BOMs' do, and each module's own snapshot type fits this one as is.
export interface AuditCompositionMaterial {
  readonly name: string;
  readonly weightInGrams?: number;
}

export interface AuditCompositionComponent {
  readonly name: string;
  readonly materials: readonly AuditCompositionMaterial[];
}

// The field key every composition line carries — one line per component.
export const COMPONENT_FIELD = 'component';

interface SnapshotLine {
  readonly field: string;
  readonly value: string;
}

export class AuditSnapshot {
  private constructor(private readonly lines: readonly SnapshotLine[]) {}

  /**
   * `fields` in the order they should read; then one `component` line per
   * component of `components`, in composition order.
   */
  static of(
    fields: Readonly<Record<string, AuditFieldValue>>,
    components: readonly AuditCompositionComponent[] = [],
  ): AuditSnapshot {
    const lines = [
      ...Object.entries(fields).map(([field, value]) => ({
        field,
        value: renderValue(value),
      })),
      ...components.map((component) => ({
        field: COMPONENT_FIELD,
        value: describeComponent(component),
      })),
    ].filter((line) => line.value !== '');
    return new AuditSnapshot(lines);
  }

  /** Every line as registered: `''` → value. */
  asRegistration(): AuditChange[] {
    return this.lines.map(({ field, value }) => ({
      field,
      previousValue: '',
      newValue: value,
    }));
  }

  /** Every line as it stood when deleted: value → `''`. */
  asDeletion(): AuditChange[] {
    return this.lines.map(({ field, value }) => ({
      field,
      previousValue: value,
      newValue: '',
    }));
  }
}

/**
 * The `component` lines for a composition replaced wholesale by an edit.
 * Components are paired by name (the n-th "Core" before with the n-th "Core"
 * after): a changed one reads before → after, a removed one before → `''`,
 * an added one `''` → after, and an unchanged one is left out — so only what
 * really differs shows, removed/changed lines in their previous order, then
 * added ones in their new order.
 *
 * The aggregate only reports a replacement when the composition really
 * differs, but it compares line identities and order too; when nothing
 * differs *by name and content* (components merely reordered, say), every
 * position is listed before → after instead, so an entry is never empty.
 */
export function compositionReplacementChanges(
  previous: readonly AuditCompositionComponent[],
  current: readonly AuditCompositionComponent[],
): AuditChange[] {
  const before = previous.map((component) => describedComponent(component));
  const unmatchedAfter = current.map((component) =>
    describedComponent(component),
  );
  const changes: AuditChange[] = [];

  for (const old of before) {
    const index = unmatchedAfter.findIndex(
      (candidate) => candidate.name === old.name,
    );
    if (index === -1) {
      changes.push(componentChange(old.text, ''));
      continue;
    }
    const [replacement] = unmatchedAfter.splice(index, 1);
    if (replacement.text !== old.text) {
      changes.push(componentChange(old.text, replacement.text));
    }
  }
  for (const added of unmatchedAfter) {
    changes.push(componentChange('', added.text));
  }

  if (changes.length > 0) {
    return changes;
  }
  const length = Math.max(previous.length, current.length);
  return Array.from({ length }, (_, index) =>
    componentChange(
      before[index]?.text ?? '',
      current[index] === undefined ? '' : describeComponent(current[index]),
    ),
  );
}

/**
 * The lines for a composition edit that changed nothing but weights — the
 * same components holding the same materials, in the same order: one line
 * per material whose weight moved, field `materialWeight:<component>:<material>`
 * and the two weights as values, in composition order. `null` for any other
 * edit (a component or material added, removed, swapped or reordered, or no
 * weight moved at all), which `compositionReplacementChanges()` describes
 * instead.
 */
export function materialWeightChanges(
  previous: readonly AuditCompositionComponent[],
  current: readonly AuditCompositionComponent[],
): AuditChange[] | null {
  const sameShape =
    previous.length === current.length &&
    previous.every(
      (component, index) =>
        component.name === current[index].name &&
        component.materials.length === current[index].materials.length &&
        component.materials.every(
          (material, materialIndex) =>
            material.name === current[index].materials[materialIndex].name,
        ),
    );
  if (!sameShape) {
    return null;
  }
  const changes = previous.flatMap((component, index) =>
    component.materials.flatMap((material, materialIndex) => {
      const after = current[index].materials[materialIndex];
      return material.weightInGrams === after.weightInGrams
        ? []
        : [
            {
              field: `materialWeight:${component.name}:${material.name}`,
              previousValue: String(material.weightInGrams),
              newValue: String(after.weightInGrams),
            },
          ];
    }),
  );
  return changes.length === 0 ? null : changes;
}

/**
 * `"<component>: <material>، <material>"`, each weighed material as
 * `"<material> (<grams> گرم)"` — e.g. `"Core: Copper (12.5 گرم)، PVC (3 گرم)"`
 * for a standard BOM or BOM, `"Core: Copper، PVC"` for a product.
 */
export function describeComponent(
  component: AuditCompositionComponent,
): string {
  const materials = component.materials
    .map((material) =>
      material.weightInGrams === undefined
        ? material.name
        : `${material.name} (${material.weightInGrams} گرم)`,
    )
    .join('، ');
  return `${component.name}: ${materials}`;
}

function describedComponent(component: AuditCompositionComponent): {
  name: string;
  text: string;
} {
  return { name: component.name, text: describeComponent(component) };
}

function componentChange(previousValue: string, newValue: string): AuditChange {
  return { field: COMPONENT_FIELD, previousValue, newValue };
}

function renderValue(value: AuditFieldValue): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
}
