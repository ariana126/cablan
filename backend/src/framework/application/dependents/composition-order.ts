/**
 * `lines` laid out in the order of `orderedComponentIds` (issue #122) — what a
 * `CompositionOrderPropagator` applies to its snapshot of a composition. Each
 * id takes the first line of that component not yet taken, so a component
 * listed twice is matched occurrence by occurrence; the lines no id took keep
 * their relative order after the matched ones. Ids the lines do not hold are
 * skipped. Pure: the input is left as it is.
 */
export function orderedByComponentIds<T extends { componentId: string }>(
  lines: readonly T[],
  orderedComponentIds: readonly string[],
): T[] {
  const remaining = [...lines];
  const matched: T[] = [];
  for (const componentId of orderedComponentIds) {
    const index = remaining.findIndex(
      (line) => line.componentId === componentId,
    );
    if (index !== -1) {
      matched.push(...remaining.splice(index, 1));
    }
  }
  return [...matched, ...remaining];
}

/** A stored line of one snapshot of a composition, as a propagator reads it. */
export interface StoredComponentLine {
  readonly id: string;
  /** The snapshot it belongs to (a standard BOM, a daily BOM). */
  readonly parentId: string;
  readonly componentId: string;
  readonly position: number;
}

/**
 * The new `position` of every stored line that moves when each snapshot is
 * laid out in the order of `orderedComponentIds` — the snapshots' lines
 * grouped by `parentId`, each group read in its stored order, then ordered by
 * `orderedByComponentIds` and numbered from 0. Snapshots in the order they
 * first appear; lines that keep their place are left out.
 */
export function repositionedComponentLines(
  lines: readonly StoredComponentLine[],
  orderedComponentIds: readonly string[],
): { id: string; position: number }[] {
  const byParent = new Map<string, StoredComponentLine[]>();
  for (const line of lines) {
    byParent.set(line.parentId, [...(byParent.get(line.parentId) ?? []), line]);
  }
  return [...byParent.values()].flatMap((snapshot) =>
    orderedByComponentIds(
      snapshot.toSorted((a, b) => a.position - b.position),
      orderedComponentIds,
    ).flatMap((line, position) =>
      line.position === position ? [] : [{ id: line.id, position }],
    ),
  );
}
