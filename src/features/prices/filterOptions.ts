import type { FieldOption } from '../../components/form/types'

/** "AGREGADOS (301)": the name people know, with the catalog code. */
export function familyLabel(family: { code: string; name: string }): string {
  return `${family.name} (${family.code})`
}

/** "M3 (Metro cúbico)", or just the code when it has no description. */
export function unitLabel(unit: { code: string; description: string | null }): string {
  return unit.description ? `${unit.code} (${unit.description})` : unit.code
}

/** "Home Depot (Periférico Sur)", or just the name when it has no branch. */
export function supplierLabel(supplier: { name: string; branch: string | null }): string {
  return supplier.branch ? `${supplier.name} (${supplier.branch})` : supplier.name
}

/**
 * Options of a filter select: active entries in the server's order, then the
 * archived ones marked with `archivedWord`, so a Resource filed under an
 * archived Unit or Family can still be found.
 */
export function archivedLast<T extends { id: string; archivedAt: string | null }>(
  items: readonly T[],
  label: (item: T) => string,
  archivedWord: string,
): FieldOption[] {
  const active: FieldOption[] = []
  const archived: FieldOption[] = []
  for (const item of items) {
    if (item.archivedAt) archived.push({ value: item.id, label: `${label(item)} · ${archivedWord}` })
    else active.push({ value: item.id, label: label(item) })
  }
  return [...active, ...archived]
}
