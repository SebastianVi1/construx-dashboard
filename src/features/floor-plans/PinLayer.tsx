import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { Pin } from './pinsApi'
import { pinVariant } from './pinForm'
import { escapeHtml } from './zoneOccupants'

interface PinLayerProps {
  map: L.Map
  pins: Pin[]
  visible: boolean
  selectedId: string | null
  /** Where a pin being created will go, in plan pixels. */
  draft: { x: number; y: number } | null
  /** Accessible name of a pin: its title, or its kind when it has none. */
  labelOf: (pin: Pin) => string
  onPinClick: (pin: Pin) => void
}

const ISSUE_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v6"/><circle cx="12" cy="16.5" r="0.6" fill="currentColor"/></svg>'
const DONE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 12.5 3.5 3.5L17 9"/></svg>'
const PHOTO_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9h3l1.5-2h5L16 9h3v9H5z"/><circle cx="12" cy="13.5" r="2.5"/></svg>'

function pinHtml(variant: string, label: string, selected: boolean): string {
  const glyph = variant === 'photo' ? PHOTO_SVG : variant === 'issue-open' ? ISSUE_SVG : DONE_SVG
  return `<span class="plan-pin plan-pin--${variant}${selected ? ' plan-pin--selected' : ''}" role="button" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${glyph}</span>`
}

/** Size of the marker box; the tip of the pin (bottom centre) is the marked spot. */
const SIZE = 32

/** Draws pins as markers over the plan. Pins are in image pixels: Leaflet `[lat, lng]` is `[y, x]`. */
export function PinLayer({ map, pins, visible, selectedId, draft, labelOf, onPinClick }: PinLayerProps) {
  const groupRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!groupRef.current) groupRef.current = L.layerGroup().addTo(map)
    const group = groupRef.current
    group.clearLayers()

    const icon = (html: string) =>
      L.divIcon({ className: 'plan-pin-icon', html, iconSize: [SIZE, SIZE], iconAnchor: [SIZE / 2, SIZE] })

    if (visible) {
      for (const pin of pins) {
        const selected = pin.id === selectedId
        const marker = L.marker([pin.y, pin.x], {
          icon: icon(pinHtml(pinVariant(pin), labelOf(pin), selected)),
          zIndexOffset: selected ? 1000 : 0,
        })
        marker.on('click', (e: L.LeafletMouseEvent) => {
          // The plan under the pin must not also take the click (zone selection, pin placing)
          L.DomEvent.stopPropagation(e)
          onPinClick(pin)
        })
        group.addLayer(marker)
      }
    }
    // The pin being created shows even with the layer hidden: it is what the form is about
    if (draft) {
      group.addLayer(
        L.marker([draft.y, draft.x], {
          icon: icon('<span class="plan-pin plan-pin--draft" aria-hidden="true"></span>'),
          interactive: false,
          zIndexOffset: 2000,
        }),
      )
    }
    return () => {
      group.clearLayers()
    }
  }, [map, pins, visible, selectedId, draft, labelOf, onPinClick])

  useEffect(() => {
    return () => {
      groupRef.current?.remove()
      groupRef.current = null
    }
  }, [map])

  return null
}
