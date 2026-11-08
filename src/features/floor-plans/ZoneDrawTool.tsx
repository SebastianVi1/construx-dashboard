import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet-draw'
import 'leaflet-draw/dist/leaflet.draw.css'
import { useLocale } from '../../i18n'
import { createZone } from './zonesApi'
import type { Zone, ZoneStatus } from './zonesApi'
import '../../components/form/form.css'

interface ZoneDrawToolProps {
  map: L.Map
  metersPerPx: number
  organizationId: string
  siteId: string
  floorPlanId: string
  onZoneCreated: (zone: Zone) => void
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
      setPendingPoints(metres)
      map.removeLayer(event.layer)
    }

    map.on(L.Draw.Event.CREATED, onCreated)
    return () => {
      map.off(L.Draw.Event.CREATED, onCreated)
    }
  }, [map, metersPerPx])

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
    } catch {
      setError(t.createError)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="zone-draw-tool">
      <div className="zone-draw-tool__buttons">
        <button
          type="button"
          className={`button${drawMode === 'polygon' ? ' button--active' : ''}`}
          onClick={() => setDrawMode((m) => (m === 'polygon' ? null : 'polygon'))}
          disabled={pendingPoints !== null}
        >
          {t.drawPolygon}
        </button>
        <button
          type="button"
          className={`button${drawMode === 'rectangle' ? ' button--active' : ''}`}
          onClick={() => setDrawMode((m) => (m === 'rectangle' ? null : 'rectangle'))}
          disabled={pendingPoints !== null}
        >
          {t.drawRectangle}
        </button>
      </div>

      {pendingPoints ? (
        <form className="zone-draw-tool__form form" onSubmit={handleSubmit}>
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
          {error ? <p className="form-error">{error}</p> : null}
          <div className="zone-draw-tool__actions">
            <button type="submit" className="button button--primary" disabled={submitting || !name.trim()}>
              {submitting ? t.saving : t.saveZone}
            </button>
            <button type="button" className="button" onClick={handleCancel} disabled={submitting}>
              {t.cancel}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
