import { useEffect, useRef, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { FloorPlan } from './floorPlansApi'
import { viewUrlExpiresSoon } from './floorPlansApi'

interface FloorPlanViewerProps {
  floorPlan: FloorPlan
  onRefreshNeeded: () => void
}

/** Leaflet CRS.Simple viewer for a rendered floor plan PNG. */
export function FloorPlanViewer({ floorPlan, onRefreshNeeded }: FloorPlanViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  const initMap = useCallback(
    (viewUrl: string) => {
      if (!containerRef.current) return

      // Clean up any existing map
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }

      const img = new Image()
      img.onload = () => {
        if (!containerRef.current) return
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
      }
      img.src = viewUrl
    },
    [],
  )

  useEffect(() => {
    if (floorPlan.viewUrl) {
      initMap(floorPlan.viewUrl)
    }
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [floorPlan.viewUrl, initMap])

  // Poll for URL expiry and request a refresh
  useEffect(() => {
    const interval = setInterval(() => {
      if (viewUrlExpiresSoon(floorPlan)) {
        onRefreshNeeded()
      }
    }, 60_000)
    return () => clearInterval(interval)
  }, [floorPlan, onRefreshNeeded])

  if (!floorPlan.viewUrl) return null

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '600px', background: 'var(--cx-paper-dim)' }}
    />
  )
}
