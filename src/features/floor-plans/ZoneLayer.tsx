import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import type { Zone } from './zonesApi'
import { ZONE_STATUS_COLORS } from './zonesApi'
import type { DraggableResource, ReassignDrag } from './zoneAssignmentsApi'
import type { Occupant } from './zoneOccupants'
import { escapeHtml, occupantAnchorKey, parseDropPayload, zoneAtPoint } from './zoneOccupants'
import { occupantStripSize, placeOccupants, type Box } from './occupantPlacement'

interface ZoneLayerProps {
  map: L.Map
  zones: Zone[]
  metersPerPx: number
  visible: boolean
  onZoneClick: (zone: Zone) => void
  /** Workers and equipment to draw inside each zone, keyed by zone id. */
  occupants?: Record<string, Occupant[]>
  /** True while a resource or an assignment is being dragged, to highlight the drop targets. */
  dragging?: boolean
  onDropResource?: (zone: Zone, resource: DraggableResource) => void
  onReassignDrop?: (zone: Zone, drag: ReassignDrag) => void
  /** Clicking a figure opens that occupant; clicking around the figures still opens the zone. */
  onOccupantClick?: (zone: Zone, occupant: Occupant) => void
  /** The figure whose bubble is open, as `occupantAnchorKey` gives it, to mark it as expanded. */
  activeOccupantKey?: string | null
  /** Pins shown on the plan, in image pixels; the figures keep clear of them. */
  avoidPins?: Array<{ x: number; y: number }>
}

/** Screen box of a pin marker: 32 px wide, standing on its point. */
const PIN_BOX = { width: 32, height: 34 }

/** Most figures drawn in one zone before the rest collapse into a "+N" chip. */
const MAX_FIGURES = 12

const PERSON_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="6" r="4"/><path d="M4 22v-3a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v3z"/></svg>'
const EQUIPMENT_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 17V9h11l3 4h4a2 2 0 0 1 2 2v2h-2a3 3 0 0 0-6 0H9a3 3 0 0 0-6 0z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>'

function occupantsHtml(zone: Zone, list: Occupant[], activeKey: string | null | undefined, color: string): string {
  const shown = list.slice(0, MAX_FIGURES)
  const figures = shown
    .map((o, i) => {
      let inner: string
      if (o.kind === 'person' && o.avatarUrl) {
        inner = `<img src="${escapeHtml(o.avatarUrl)}" class="zone-occupant__avatar" aria-hidden="true" />`
      } else {
        inner = o.kind === 'person' ? PERSON_SVG : EQUIPMENT_SVG
      }
      const key = occupantAnchorKey(zone, o)
      const expanded = key === activeKey ? 'true' : 'false'
      return `<span class="zone-occupant zone-occupant--${o.kind}" data-occupant="${i}" data-occupant-key="${escapeHtml(key)}" role="button" aria-expanded="${expanded}" aria-label="${escapeHtml(o.label)}" title="${escapeHtml(o.label)}">${inner}</span>`
    })
    .join('')
  const rest = list.length - shown.length
  const more = rest > 0 ? `<span class="zone-occupant-more">+${rest}</span>` : ''
  // The zone's colour frames its figures, since they stand beside the zone and not on it
  return `<div class="zone-occupants" style="--zone-color:${color}">${figures}${more}</div>`
}

/** Renders floor plan zones as filled Leaflet polygons in pixel coordinate space. */
export function ZoneLayer({
  map,
  zones,
  metersPerPx,
  visible,
  onZoneClick,
  occupants,
  dragging,
  onDropResource,
  onReassignDrop,
  onOccupantClick,
  activeOccupantKey,
  avoidPins,
}: ZoneLayerProps) {
  // Figures have a fixed screen size while zones scale, so their side is chosen again at each zoom
  const [zoom, setZoom] = useState(() => map.getZoom())
  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom())
    map.on('zoomend', onZoom)
    return () => {
      map.off('zoomend', onZoom)
    }
  }, [map])

  const layerGroupRef = useRef<L.LayerGroup | null>(null)
  const occupantGroupRef = useRef<L.LayerGroup | null>(null)
  const dropOverlayGroupRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!layerGroupRef.current) {
      layerGroupRef.current = L.layerGroup().addTo(map)
    }
    if (!occupantGroupRef.current) {
      occupantGroupRef.current = L.layerGroup().addTo(map)
    }
    const group = layerGroupRef.current
    const occupantGroup = occupantGroupRef.current
    group.clearLayers()
    occupantGroup.clearLayers()

    if (!visible) return

    const screenBox = (bounds: L.LatLngBounds): Box => {
      const a = map.latLngToLayerPoint(bounds.getNorthWest())
      const b = map.latLngToLayerPoint(bounds.getSouthEast())
      return { minX: a.x, minY: a.y, maxX: b.x, maxY: b.y }
    }
    const zoneBoxes = new Map(
      zones.map((zone) => [
        zone.id,
        screenBox(L.latLngBounds(zone.points.map(([x, y]) => L.latLng(y / metersPerPx, x / metersPerPx)))),
      ]),
    )
    const pinBoxes: Box[] = (avoidPins ?? []).map((pin) => {
      const point = map.latLngToLayerPoint([pin.y, pin.x])
      return {
        minX: point.x - PIN_BOX.width / 2,
        minY: point.y - PIN_BOX.height,
        maxX: point.x + PIN_BOX.width / 2,
        maxY: point.y,
      }
    })

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

      const list = occupants?.[zone.id] ?? []
      if (list.length > 0) {
        const icon = L.divIcon({ className: 'zone-occupants-icon', html: occupantsHtml(zone, list, activeOccupantKey, color), iconSize: undefined })
        // Beside the zone, on the first side clear of other zones and pins, so nothing pinned inside is covered
        const shown = Math.min(list.length, MAX_FIGURES) + (list.length > MAX_FIGURES ? 1 : 0)
        const others = [...zoneBoxes].filter(([id]) => id !== zone.id).map(([, box]) => box)
        const spot = placeOccupants(zoneBoxes.get(zone.id)!, occupantStripSize(shown), [...others, ...pinBoxes])
        const marker = L.marker(map.layerPointToLatLng([spot.x, spot.y]), { icon, keyboard: false })
        marker.on('click', (e: L.LeafletMouseEvent) => {
          const figure = (e.originalEvent.target as Element | null)?.closest('[data-occupant]')
          const occupant = figure ? list[Number(figure.getAttribute('data-occupant'))] : undefined
          if (occupant && onOccupantClick) onOccupantClick(zone, occupant)
          else onZoneClick(zone)
        })
        occupantGroup.addLayer(marker)
      }
    }

    return () => {
      group.clearLayers()
      occupantGroup.clearLayers()
    }
  }, [map, zones, metersPerPx, visible, onZoneClick, onOccupantClick, occupants, activeOccupantKey, avoidPins, zoom])

  // Highlight every zone as a drop target while something is being dragged
  useEffect(() => {
    if (!dropOverlayGroupRef.current) {
      dropOverlayGroupRef.current = L.layerGroup().addTo(map)
    }
    const overlayGroup = dropOverlayGroupRef.current
    overlayGroup.clearLayers()
    if (!visible || !dragging) return

    const primary = getComputedStyle(document.documentElement).getPropertyValue('--cx-primary').trim()
    for (const zone of zones) {
      const latlngs = zone.points.map(([x, y]) => L.latLng(y / metersPerPx, x / metersPerPx))
      overlayGroup.addLayer(
        L.polygon(latlngs, {
          color: primary,
          fillColor: primary,
          fillOpacity: 0.15,
          weight: 3,
          dashArray: '6 4',
          interactive: false,
        }),
      )
    }

    return () => {
      overlayGroup.clearLayers()
    }
  }, [map, zones, metersPerPx, visible, dragging])

  // HTML5 drops never reach Leaflet as clicks, so resolve the zone under the cursor ourselves
  useEffect(() => {
    if (!visible) return
    const container = map.getContainer()

    function zoneUnder(e: DragEvent): Zone | null {
      const { lat, lng } = map.mouseEventToLatLng(e)
      return zoneAtPoint(zones, [lng * metersPerPx, lat * metersPerPx])
    }

    function onDragOver(e: DragEvent) {
      if (!e.dataTransfer?.types.includes('application/json')) return
      e.preventDefault()
      e.dataTransfer.dropEffect = zoneUnder(e) ? 'move' : 'none'
    }

    function onDrop(e: DragEvent) {
      const payload = parseDropPayload(e.dataTransfer?.getData('application/json') ?? '')
      if (!payload) return
      e.preventDefault()
      const zone = zoneUnder(e)
      if (!zone) return
      if ('assignmentId' in payload) onReassignDrop?.(zone, payload)
      else onDropResource?.(zone, payload)
    }

    container.addEventListener('dragover', onDragOver)
    container.addEventListener('drop', onDrop)
    return () => {
      container.removeEventListener('dragover', onDragOver)
      container.removeEventListener('drop', onDrop)
    }
  }, [map, zones, metersPerPx, visible, onDropResource, onReassignDrop])

  // Remove layer groups on unmount
  useEffect(() => {
    return () => {
      for (const ref of [layerGroupRef, occupantGroupRef, dropOverlayGroupRef]) {
        ref.current?.remove()
        ref.current = null
      }
    }
  }, [map])

  return null
}
