import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useLocale } from '../../i18n'
import type { FloorPlan } from './floorPlansApi'

interface FloorPlanViewerProps {
  floorPlan: FloorPlan
  onMapReady?: (map: L.Map) => void
  /** Read the plan again for a fresh view URL after its image failed to load. */
  onRetry?: () => void
}

type ViewState = 'loading' | 'ready' | 'error'

/**
 * Leaflet CRS.Simple viewer for a rendered floor plan PNG. Keeping its URL fresh is `useFloorPlan`'s
 * job; this component still speaks up while the image is on its way and when it cannot be loaded,
 * so the canvas is never left as an empty blue sheet.
 */
export function FloorPlanViewer({ floorPlan, onMapReady, onRetry }: FloorPlanViewerProps) {
  const { messages: m } = useLocale()
  const t = m.floorPlans
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  // The state belongs to the URL and the attempt it was measured for: a new URL (or a retry)
  // starts as "loading" on its own.
  const [attempt, setAttempt] = useState(0)
  const [view, setView] = useState<{ url: string | null; attempt: number; kind: ViewState }>({
    url: null,
    attempt: 0,
    kind: 'loading',
  })
  const viewUrl = floorPlan.viewUrl
  const state: ViewState =
    view.url === viewUrl && view.attempt === attempt ? view.kind : viewUrl ? 'loading' : 'error'

  useEffect(() => {
    // Drop the previous map before this run; its image may be stale or belong to another plan.
    mapRef.current?.remove()
    mapRef.current = null

    if (!viewUrl) return

    let cancelled = false

    const img = new Image()
    img.onload = () => {
      // A re-render, a URL refresh or StrictMode's double effect may have replaced this run.
      if (cancelled || !containerRef.current) return
      const { naturalWidth: w, naturalHeight: h } = img
      // CRS.Simple: y axis is inverted, origin at bottom-left
      const bounds: L.LatLngBoundsExpression = [
        [0, 0],
        [h, w],
      ]

      const map = L.map(containerRef.current, {
        crs: L.CRS.Simple,
        minZoom: -4,
        maxZoom: 4,
        zoomControl: false,
      })
      mapRef.current = map

      L.imageOverlay(viewUrl, bounds).addTo(map)
      map.fitBounds(bounds)
      L.control.zoom({ position: 'topright' }).addTo(map)
      setView({ url: viewUrl, attempt, kind: 'ready' })
      onMapReady?.(map)
    }
    img.onerror = () => {
      if (!cancelled) setView({ url: viewUrl, attempt, kind: 'error' })
    }
    img.src = viewUrl

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewUrl, attempt])

  return (
    <div className="floor-plan-viewer">
      <div ref={containerRef} className="floor-plan-viewer__map" />
      {state === 'ready' ? null : (
        <div className="floor-plan-viewer__state" role={state === 'error' ? 'alert' : 'status'}>
          {state === 'error' ? (
            <>
              <p>{t.viewError}</p>
              {onRetry ? (
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    // Ask for the image again, even when the address is the same one that failed.
                    setAttempt((value) => value + 1)
                    onRetry()
                  }}
                >
                  {t.retry}
                </button>
              ) : null}
            </>
          ) : (
            <>
              <span className="floor-plan-viewer__spinner" aria-hidden="true" />
              <p>{t.preparingView}</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
