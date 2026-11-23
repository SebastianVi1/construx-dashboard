/**
 * Keeps the caller's own permissions fresh (roles contract §8.5, D9): a role
 * edit takes effect on the member's next request, so the dashboard reads
 * `/me` again when they come back to the tab or move to another screen, at
 * most once per `ACCESS_REFRESH_MIN_MS`, instead of waiting for a reload.
 */

export const ACCESS_REFRESH_MIN_MS = 30_000

export type AccessFreshnessOptions = {
  /** Fires `visibilitychange`; the document in the app. */
  page: EventTarget
  isVisible: () => boolean
  reload: () => void
  now?: () => number
  minIntervalMs?: number
}

export type AccessFreshness = {
  /** Call on every route change. */
  routeChanged: () => void
  stop: () => void
}

/** Starts counting from now, which is when the provider made its first `/me` request. */
export function watchAccessFreshness({
  page,
  isVisible,
  reload,
  now = Date.now,
  minIntervalMs = ACCESS_REFRESH_MIN_MS,
}: AccessFreshnessOptions): AccessFreshness {
  let lastLoadAt = now()
  let stopped = false

  function refresh() {
    if (stopped || now() - lastLoadAt < minIntervalMs) return
    lastLoadAt = now()
    reload()
  }

  function onVisibilityChange() {
    if (isVisible()) refresh()
  }

  page.addEventListener('visibilitychange', onVisibilityChange)
  return {
    routeChanged: refresh,
    stop: () => {
      stopped = true
      page.removeEventListener('visibilitychange', onVisibilityChange)
    },
  }
}
