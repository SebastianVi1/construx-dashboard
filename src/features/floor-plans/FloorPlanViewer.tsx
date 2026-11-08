import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { FloorPlan } from './floorPlansApi'
import { viewUrlExpiresSoon } from './floorPlansApi'

interface FloorPlanViewerProps {
  floorPlan: FloorPlan
  onRefreshNeeded: () => void
  onMapReady?: (map: L.Map) => void
}

/** Leaflet CRS.Simple viewer for a rendered floor plan PNG. */
export function FloorPlanViewer({ floorPlan, onRefreshNeeded, onMapReady }: FloorPlanViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!floorPlan.viewUrl) return
    const viewUrl = floorPlan.viewUrl

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
      onMapReady?.(map)
    }
    img.src = viewUrl

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorPlan.viewUrl])

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
    <div ref={containerRef} className="floor-plan-viewer" />
  )
}
