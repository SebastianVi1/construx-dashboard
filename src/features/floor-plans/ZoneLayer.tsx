import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { Zone } from './zonesApi'
import { ZONE_STATUS_COLORS } from './zonesApi'

interface ZoneLayerProps {
  map: L.Map
  zones: Zone[]
  metersPerPx: number
  visible: boolean
  onZoneClick: (zone: Zone) => void
  assignmentCounts?: Record<string, number>
  draggingResource?: boolean
  onDropOnZone?: (zone: Zone) => void
}

/** Renders floor plan zones as filled Leaflet polygons in pixel coordinate space. */
export function ZoneLayer({
  map,
  zones,
  metersPerPx,
  visible,
  onZoneClick,
  assignmentCounts,
  draggingResource,
  onDropOnZone,
}: ZoneLayerProps) {
  const layerGroupRef = useRef<L.LayerGroup | null>(null)
  const badgeGroupRef = useRef<L.LayerGroup | null>(null)
  const dropOverlayGroupRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!layerGroupRef.current) {
      layerGroupRef.current = L.layerGroup().addTo(map)
    }
    if (!badgeGroupRef.current) {
      badgeGroupRef.current = L.layerGroup().addTo(map)
    }
    const group = layerGroupRef.current
    const badgeGroup = badgeGroupRef.current
    group.clearLayers()
    badgeGroup.clearLayers()

    if (!visible) return

    for (const zone of zones) {
      // Convert metre coords to pixel coords: px = metres / metersPerPx
      // Leaflet CRS.Simple uses [lat=y, lng=x]
      const latlngs = zone.points.map(([x, y]) => L.latLng(y / metersPerPx, x / metersPerPx))
      const color = ZONE_STATUS_COLORS[zone.status]
      const polygon = L.polygon(latlngs, {
        color,
        fillColor: color,
        fillOpacity: 0.35,
        weight: 2,
      })
      polygon.on('click', () => onZoneClick(zone))
      group.addLayer(polygon)

      // Badge showing active assignment count
      const count = assignmentCounts?.[zone.id] ?? 0
      if (count > 0) {
        // Compute centroid from points
        const pts = zone.points
        const cx = pts.reduce((s, [x]) => s + x, 0) / pts.length
        const cy = pts.reduce((s, [, y]) => s + y, 0) / pts.length
        const badgeIcon = L.divIcon({
          className: '',
          html: `<div class="zone-assignment-badge">${count}</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        })
        const marker = L.marker(L.latLng(cy / metersPerPx, cx / metersPerPx), { icon: badgeIcon })
        badgeGroup.addLayer(marker)
      }
    }

    return () => {
      group.clearLayers()
      badgeGroup.clearLayers()
    }
  }, [map, zones, metersPerPx, visible, onZoneClick, assignmentCounts])

  // Drop overlay rectangles while dragging a resource
  useEffect(() => {
    if (!dropOverlayGroupRef.current) {
      dropOverlayGroupRef.current = L.layerGroup().addTo(map)
    }
    const overlayGroup = dropOverlayGroupRef.current
    overlayGroup.clearLayers()

    if (!draggingResource || !visible || !onDropOnZone) return

    for (const zone of zones) {
      const latlngs = zone.points.map(([x, y]) => L.latLng(y / metersPerPx, x / metersPerPx))
      const overlay = L.polygon(latlngs, {
        color: 'var(--cx-primary, #2563eb)',
        fillColor: 'var(--cx-primary, #2563eb)',
        fillOpacity: 0.15,
        weight: 3,
        dashArray: '6 4',
      })
      overlay.on('click', () => onDropOnZone(zone))
      overlayGroup.addLayer(overlay)
    }

    return () => {
      overlayGroup.clearLayers()
    }
  }, [map, zones, metersPerPx, visible, draggingResource, onDropOnZone])

  // Remove layer groups on unmount
  useEffect(() => {
    return () => {
      if (layerGroupRef.current) {
        layerGroupRef.current.remove()
        layerGroupRef.current = null
      }
      if (badgeGroupRef.current) {
        badgeGroupRef.current.remove()
        badgeGroupRef.current = null
      }
      if (dropOverlayGroupRef.current) {
        dropOverlayGroupRef.current.remove()
        dropOverlayGroupRef.current = null
      }
    }
  }, [map])

  return null
}
