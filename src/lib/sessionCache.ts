/**
 * Values already shown in this tab, keyed by whatever identifies them (for
 * example a `useRemoteData` key). A screen that has rendered once reads its
 * value back on the next mount, so navigating away and back shows content
 * immediately instead of a loading placeholder all over again.
 *
 * Only the live module holds this: a full reload starts empty, and signing out
 * clears it so the next person never sees the previous session's rows.
 */
const shown = new Map<string, unknown>()

/** Browsing a long list of detail pages must not grow the tab without bound. */
const MAX_ENTRIES = 200

/** The value a previous visit showed for `key`, or undefined if there is none. */
export function readSessionValue<T>(key: string): T | undefined {
  return shown.get(key) as T | undefined
}

export function hasSessionValue(key: string): boolean {
  return shown.has(key)
}

/** Remember the value a screen just showed for `key`. */
export function writeSessionValue<T>(key: string, value: T): void {
  if (shown.size >= MAX_ENTRIES && !shown.has(key)) {
    shown.delete(shown.keys().next().value as string)
  }
  shown.set(key, value)
}

/** Drop every value, e.g. when the session ends. */
export function clearSessionValues(): void {
  shown.clear()
}
