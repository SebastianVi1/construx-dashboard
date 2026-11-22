import type { TourFacts } from './tourCatalog'

/**
 * What the guided tour remembers in this browser for one Company: the ids it
 * created and whether it was ever started here. One key per Company (as in
 * `lastSite.ts`), so an id never leaks into another Company's tour.
 */
export type TourMemory = { started?: true; siteId?: string }

/** Subset of `Storage` the memory needs; tests pass a fake. */
export type TourStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export const tourMemoryKey = (organizationId: string) => `construx.guide.tour.${organizationId}`

/** `localStorage`, or undefined where reading it throws (blocked storage) or it doesn't exist. */
function defaultStorage(): TourStorage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

/** Keeps only the known keys with valid values. */
function clean(value: unknown): TourMemory {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const raw = value as Record<string, unknown>
  const memory: TourMemory = {}
  if (raw.started === true) memory.started = true
  if (typeof raw.siteId === 'string' && raw.siteId !== '') memory.siteId = raw.siteId
  return memory
}

/** The memory, or `{}` when absent, unreadable, not JSON, or blocked. Unknown keys and non-string / empty ids are dropped. Never throws. */
export function readTourMemory(organizationId: string, storage: TourStorage | undefined = defaultStorage()): TourMemory {
  try {
    const stored = storage?.getItem(tourMemoryKey(organizationId))
    return stored ? clean(JSON.parse(stored)) : {}
  } catch {
    return {}
  }
}

/** Merge `ids` into the stored memory and return the merged value. A write that fails keeps the merge for this visit only. Never throws. */
export function rememberTourIds(
  organizationId: string,
  ids: TourMemory,
  storage: TourStorage | undefined = defaultStorage(),
): TourMemory {
  const merged = clean({ ...readTourMemory(organizationId, storage), ...ids })
  try {
    storage?.setItem(tourMemoryKey(organizationId), JSON.stringify(merged))
  } catch {
    // Storage full or blocked: the caller keeps the merged value for this visit.
  }
  return merged
}

/** Remove the Company's memory (dev "Start tour" only). Never throws. */
export function forgetTourMemory(organizationId: string, storage: TourStorage | undefined = defaultStorage()): void {
  try {
    storage?.removeItem(tourMemoryKey(organizationId))
  } catch {
    // Blocked storage has nothing to forget.
  }
}

/** Facts inside a Company: hasCompany true, siteId from memory. */
export function tourFactsFrom(memory: TourMemory): TourFacts {
  return { hasCompany: true, siteId: memory.siteId ?? null }
}
