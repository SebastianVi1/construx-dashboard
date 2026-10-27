import { useEffect, useEffectEvent, useState } from 'react'

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

/**
 * Load data for a key (for example `organizationId:siteId`). A new key fetches
 * again and drops data of the old one, so a company switch never shows another
 * company's rows; answers for an old key or request are ignored. `null` key
 * means "do not load".
 */
export function useRemoteData<T>(key: string | null, load: () => Promise<T>): RemoteData<T> {
  const [request, setRequest] = useState(0)
  const [loaded, setLoaded] = useState<Loaded<T> | null>(null)
  const run = useEffectEvent(() => load())

  useEffect(() => {
    if (key === null) return
    let active = true
    run().then(
      (data) => {
        if (active) setLoaded({ key, request, ok: true, data })
      },
      (error: unknown) => {
        if (active) setLoaded({ key, request, ok: false, error })
      },
    )
    return () => {
      active = false
    }
  }, [key, request])

  const forKey = key !== null && loaded?.key === key ? loaded : null
  const fresh = forKey?.request === request ? forKey : null
  const status: RemoteStatus = key === null ? 'idle' : !fresh ? 'loading' : fresh.ok ? 'ready' : 'error'

  return {
    status,
    data: forKey?.ok ? forKey.data : undefined,
    error: fresh && !fresh.ok ? fresh.error : undefined,
    reload: () => setRequest((value) => value + 1),
    update: (change) =>
      setLoaded((previous) =>
        previous && previous.key === key && previous.ok ? { ...previous, data: change(previous.data) } : previous,
      ),
  }
}
