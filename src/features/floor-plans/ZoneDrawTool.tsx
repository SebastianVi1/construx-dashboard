import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import L from 'leaflet'
import 'leaflet-draw'
import 'leaflet-draw/dist/leaflet.draw.css'
import { useLocale } from '../../i18n'
import { ApiError } from '../../lib/http'
import { createZone } from './zonesApi'
import { MIN_ZONE_AREA_M2, polygonArea } from './zoneOccupants'
import type { Zone, ZoneStatus } from './zonesApi'
import { PolygonIcon, RectangleIcon } from './floorPlanIcons'
import '../../components/form/form.css'

interface ZoneDrawToolProps {
  map: L.Map
  metersPerPx: number
  organizationId: string
  siteId: string
  floorPlanId: string
  onZoneCreated: (zone: Zone) => void
  /** Element over the plan where the drawing hint and the new-zone form float. */
  overlayHost: HTMLElement | null
}

type DrawMode = 'polygon' | 'rectangle' | null

/** Draws new zones on a floor plan using leaflet-draw. */
export function ZoneDrawTool({
  map,
  metersPerPx,
  organizationId,
  siteId,
  floorPlanId,
  onZoneCreated,
  overlayHost,
}: ZoneDrawToolProps) {
  const { messages: m } = useLocale()
  const t = m.floorPlans.zones
  const drawRef = useRef<L.Draw.Polygon | L.Draw.Rectangle | null>(null)
  const [drawMode, setDrawMode] = useState<DrawMode>(null)
  const [pendingPoints, setPendingPoints] = useState<[number, number][] | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<ZoneStatus>('NOT_STARTED')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Activate draw handler when drawMode changes
  useEffect(() => {
    if (drawRef.current) {
      drawRef.current.disable()
      drawRef.current = null
    }

    if (!drawMode) return

    // showArea is off because leaflet-draw 1.0.4's readableArea throws
    // "type is not defined" in strict mode, which freezes the rectangle mid-drag.
    const handler =
      drawMode === 'polygon'
        ? new L.Draw.Polygon(map as L.DrawMap, { showArea: false })
        : new L.Draw.Rectangle(map as L.DrawMap, { showArea: false })
    handler.enable()
    drawRef.current = handler

    return () => {
      handler.disable()
      drawRef.current = null
    }
  }, [drawMode, map])

  // Listen for draw:created events
  useEffect(() => {
    const onCreated = (e: L.LeafletEvent) => {
      const event = e as unknown as L.DrawEvents.Created
      setDrawMode(null)
      let pixelPoints: L.LatLng[] = []
      if (event.layerType === 'polygon') {
        pixelPoints = (event.layer as L.Polygon).getLatLngs()[0] as L.LatLng[]
      } else if (event.layerType === 'rectangle') {
        pixelPoints = (event.layer as L.Rectangle).getLatLngs()[0] as L.LatLng[]
      }
      // Convert pixel coords to metres: metres = px * metersPerPx
      const metres: [number, number][] = pixelPoints.map((ll) => [
        ll.lng * metersPerPx,
        ll.lat * metersPerPx,
      ])
      map.removeLayer(event.layer)
      // A click instead of a drag, or a polygon closed on a line, has no area: ask to draw it again
      if (polygonArea(metres) < MIN_ZONE_AREA_M2) {
        setError(t.noAreaError)
        return
      }
      setError(null)
      setPendingPoints(metres)
    }

    map.on(L.Draw.Event.CREATED, onCreated)
    return () => {
      map.off(L.Draw.Event.CREATED, onCreated)
    }
  }, [map, metersPerPx, t.noAreaError])

  const handleCancel = () => {
    setDrawMode(null)
    if (drawRef.current) {
      drawRef.current.disable()
      drawRef.current = null
    }
    setPendingPoints(null)
    setName('')
    setDescription('')
    setStatus('NOT_STARTED')
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pendingPoints || !name.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const zone = await createZone(organizationId, siteId, floorPlanId, {
        name: name.trim(),
        description: description.trim() || null,
        status,
        points: pendingPoints,
      })
      onZoneCreated(zone)
      setPendingPoints(null)
      setName('')
      setDescription('')
      setStatus('NOT_STARTED')
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'ZONE_NO_AREA' ? t.noAreaError : t.createError)
    } finally {
      setSubmitting(false)
    }
  }

  const form = pendingPoints ? (
    <form className="fp-float form" onSubmit={handleSubmit}>
      <h2 className="fp-float__title">{t.newZone}</h2>
      <div className="form-field">
        <label className="form-field__label" htmlFor="zdzone-name">{t.nameLabel}</label>
        <div className="form-field__box">
          <input
            id="zdzone-name"
            className="form-field__control"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.namePlaceholder}
            maxLength={120}
            required
            autoFocus
          />
        </div>
      </div>
      <div className="form-field">
        <label className="form-field__label" htmlFor="zdzone-desc">{t.descriptionLabel}</label>
        <div className="form-field__box">
          <input
            id="zdzone-desc"
            className="form-field__control"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t.descriptionPlaceholder}
            maxLength={500}
          />
        </div>
      </div>
      <div className="form-field" data-type="select">
        <label className="form-field__label" htmlFor="zdzone-status">{t.statusLabel}</label>
        <div className="form-field__box">
          <select
            id="zdzone-status"
            className="form-field__control"
            value={status}
            onChange={(e) => setStatus(e.target.value as ZoneStatus)}
          >
            <option value="NOT_STARTED">{t.status.NOT_STARTED}</option>
            <option value="IN_PROGRESS">{t.status.IN_PROGRESS}</option>
            <option value="ON_HOLD">{t.status.ON_HOLD}</option>
            <option value="DONE">{t.status.DONE}</option>
          </select>
        </div>
      </div>
      {error ? <p className="fp-float__error" role="alert">{error}</p> : null}
      <div className="fp-float__actions">
        <button type="button" className="button button--small" onClick={handleCancel} disabled={submitting}>
          {t.cancel}
        </button>
        <button type="submit" className="button button--small button--primary" disabled={submitting || !name.trim()}>
          {submitting ? t.saving : t.saveZone}
        </button>
      </div>
    </form>
  ) : error ? (
    <div className="fp-hint fp-hint--error" role="alert">
      <p>{error}</p>
      <button type="button" className="fp-hint__action" onClick={() => setError(null)}>
        {m.floorPlans.assignments.dismiss}
      </button>
    </div>
  ) : drawMode ? (
    <p className="fp-hint" role="status">
      {drawMode === 'polygon' ? t.polygonHint : t.rectangleHint}
    </p>
  ) : null

  return (
    <div className="floor-plan-toolbar__group">
      <button
        type="button"
        className="fp-tool"
        aria-pressed={drawMode === 'polygon'}
        onClick={() => {
          setError(null)
          setDrawMode((mode) => (mode === 'polygon' ? null : 'polygon'))
        }}
        disabled={pendingPoints !== null}
      >
        <PolygonIcon />
        {t.drawPolygon}
      </button>
      <button
        type="button"
        className="fp-tool"
        aria-pressed={drawMode === 'rectangle'}
        onClick={() => {
          setError(null)
          setDrawMode((mode) => (mode === 'rectangle' ? null : 'rectangle'))
        }}
        disabled={pendingPoints !== null}
      >
        <RectangleIcon />
        {t.drawRectangle}
      </button>
      {form && overlayHost ? createPortal(form, overlayHost) : null}
    </div>
  )
}
