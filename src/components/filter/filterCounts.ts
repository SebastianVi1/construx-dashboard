export type FilterCounts<K extends string> = Record<K | 'all', number>

/**
 * Rows for the selected value (`''` keeps all) and how many rows each value has,
 * so a `FilterTabs` bar can show counts while filtering already-loaded data.
 */
export function filterCounts<T, K extends string>(
  rows: T[],
  valueOf: (row: T) => string,
  values: readonly K[],
  selected: K | '',
): { counts: FilterCounts<K>; visible: T[] } {
  const counts = { all: rows.length } as FilterCounts<K>
  for (const value of values) counts[value] = 0
  for (const row of rows) {
    const value = valueOf(row)
    if (value in counts && value !== 'all') counts[value as K] += 1
  }
  return { counts, visible: selected ? rows.filter((row) => valueOf(row) === selected) : rows }
}
