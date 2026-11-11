import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { hasSessionValue, readSessionValue, writeSessionValue } from '../../lib/sessionCache'

export type RemoteStatus = 'idle' | 'loading' | 'ready' | 'error'

export type RemoteData<T> = {
  /** `idle` without a key; `loading` until the current key and request answered. */
  status: RemoteStatus
  /** Last data loaded for the current key; kept while a reload is in flight. */
  data: T | undefined
  /** Failure of the latest request for the current key. */
  error: unknown
  reload: () => void
  /** Change the loaded data locally after a successful mutation. */
  update: (change: (current: T) => T) => void
}

type Loaded<T> = { key: string; request: number } & ({ ok: true; data: T } | { ok: false; error: unknown })

export type RemoteDataOptions = {
  /**
   * Skip the first-load minimum. Use it for reads that gate the screens below
   * them (the caller's permissions), so people see the screen's own placeholder
   * once instead of a generic panel and then the real one.
   */
  immediate?: boolean
}

/** How long a screen's first load keeps its placeholder, so the skeleton can be read. */
export const FIRST_LOAD_MIN_MS = 2000

/** Time left of the first-load minimum; zero once it has elapsed. */
export function firstLoadDelay(startedAt: number, now = Date.now(), minMs = FIRST_LOAD_MIN_MS): number {
  return Math.max(0, minMs - (now - startedAt))
}

/** When each navigation first showed a placeholder, by `location.key`. */
const windows = new Map<string, number>()

/**
 * The 2 s window belongs to the navigation, not to each request: a container
 * that mounts after the page (a tab, a panel) waits only for what is left of
 * the same window instead of adding a second delay of its own.
 */
export function firstLoadWindow(screen: string, now = Date.now()): number {
  const started = windows.get(screen)
  if (started !== undefined) return started
  if (windows.size >= 40) windows.delete(windows.keys().next().value as string)
  windows.set(screen, now)
  return now
}

/** Forget the windows of a past session along with its cached data. */
export function clearFirstLoadWindows(): void {
  windows.clear()
}

/**
 * Load data for a key (for example `organizationId:siteId`). A new key fetches
 * again and drops data of the old one, so a company switch never shows another
 * company's rows; answers for an old key or request are ignored. `null` key
 * means "do not load".
 *
 * A key this tab has already shown starts from its last value and revalidates
 * in the background: no placeholder and no first-load wait on the way back.
 * Only a genuinely new screen stays in `loading` long enough to read its
 * skeleton (`FIRST_LOAD_MIN_MS`), even when the response arrives sooner.
 */
export function useRemoteData<T>(
  key: string | null,
  load: () => Promise<T>,
  { immediate = false }: RemoteDataOptions = {},
): RemoteData<T> {
  const [request, setRequest] = useState(0)
  const [loaded, setLoaded] = useState<Loaded<T> | null>(null)
  const run = useEffectEvent(() => load())
  const screen = useLocation().key
  const screenRef = useRef(screen)

  // Keep the navigation key current without refetching when only the URL changes.
  useEffect(() => {
    screenRef.current = screen
  }, [screen])

  useEffect(() => {
    if (key === null) return
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    // A screen already shown keeps its rows on screen while this request runs.
    const alreadyShown = hasSessionValue(key)
    const startedAt = alreadyShown || immediate ? 0 : firstLoadWindow(screenRef.current)

    function commit(next: Loaded<T>) {
      if (active) setLoaded(next)
    }

    function settle(next: Loaded<T>) {
      const wait = startedAt === 0 ? 0 : firstLoadDelay(startedAt)
      if (wait > 0) timer = setTimeout(() => commit(next), wait)
      else commit(next)
    }

    run().then(
      (data) => settle({ key, request, ok: true, data }),
      (error: unknown) => {
        // A failed revalidation leaves the rows already on screen in place.
        const previous = alreadyShown ? readSessionValue<T>(key) : undefined
        if (previous !== undefined) return settle({ key, request, ok: true, data: previous })
        settle({ key, request, ok: false, error })
      },
    )
    return () => {
      active = false
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [key, request, immediate])

  // Whatever this screen shows becomes the value a later visit starts from.
  useEffect(() => {
    if (key !== null && loaded?.key === key && loaded.ok) writeSessionValue(key, loaded.data)
  }, [key, loaded])

  const current = loaded?.key === key ? loaded : null
  const cached = current === null && key !== null && hasSessionValue(key)
    ? { key, request, ok: true as const, data: readSessionValue<T>(key) as T }
    : null
  const shown = current ?? cached
  const status: RemoteStatus = key === null ? 'idle' : !shown ? 'loading' : shown.ok ? 'ready' : 'error'

  return {
    status,
    data: shown?.ok ? shown.data : undefined,
    error: shown && !shown.ok ? shown.error : undefined,
    reload: () => setRequest((value) => value + 1),
    update: (change) =>
      setLoaded((previous) =>
        previous && previous.key === key && previous.ok ? { ...previous, data: change(previous.data) } : previous,
      ),
  }
}
