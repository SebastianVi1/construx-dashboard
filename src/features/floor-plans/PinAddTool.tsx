import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import L from 'leaflet'
import { useLocale } from '../../i18n'
import { clampToBounds } from './pinForm'

interface PinAddToolProps {
  map: L.Map
  /** Where the hint floats over the plan. */
  overlayHost: HTMLElement | null
  /** The tapped point in plan pixels, pulled onto the plan image when the tap lands beside it. */
  onPlaced: (x: number, y: number) => void
  onCancel: () => void
}

/** The plan image's size in pixels, read from the viewer's image overlay. */
function imageSize(map: L.Map): { width: number; height: number } | null {
  let size: { width: number; height: number } | null = null
  map.eachLayer((layer) => {
    if (layer instanceof L.ImageOverlay) {
      const bounds = layer.getBounds()
      size = { width: bounds.getEast(), height: bounds.getNorth() }
    }
  })
  return size
}

/** While mounted, the next tap on the plan places a pin. */
export function PinAddTool({ map, overlayHost, onPlaced, onCancel }: PinAddToolProps) {
  const { messages: m } = useLocale()
  const t = m.floorPlans.pins

  useEffect(() => {
    const container = map.getContainer()
    container.classList.add('floor-plan-viewer--placing')

    function onClick(e: L.LeafletMouseEvent) {
      const size = imageSize(map)
      const [x, y] = size
        ? clampToBounds(e.latlng.lng, e.latlng.lat, size.width, size.height)
        : [Math.max(0, e.latlng.lng), Math.max(0, e.latlng.lat)]
      onPlaced(x, y)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }

    map.on('click', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      container.classList.remove('floor-plan-viewer--placing')
      map.off('click', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [map, onPlaced, onCancel])

  if (!overlayHost) return null
  return createPortal(
    <div className="fp-hint" role="status">
      {t.placeHint}
      <button type="button" className="fp-hint__action" onClick={onCancel}>
        {t.cancelPlace}
      </button>
    </div>,
    overlayHost,
  )
}
