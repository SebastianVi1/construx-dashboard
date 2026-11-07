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
}

/** Renders floor plan zones as filled Leaflet polygons in pixel coordinate space. */
export function ZoneLayer({ map, zones, metersPerPx, visible, onZoneClick }: ZoneLayerProps) {
  const layerGroupRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!layerGroupRef.current) {
      layerGroupRef.current = L.layerGroup().addTo(map)
    }
    const group = layerGroupRef.current
    group.clearLayers()

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
    }

    return () => {
      group.clearLayers()
    }
  }, [map, zones, metersPerPx, visible, onZoneClick])

  // Remove layer group on unmount
  useEffect(() => {
    return () => {
      if (layerGroupRef.current) {
        layerGroupRef.current.remove()
        layerGroupRef.current = null
      }
    }
  }, [map])

  return null
}
