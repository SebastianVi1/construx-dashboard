import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import L from 'leaflet'
import 'leaflet-draw'
import 'leaflet-draw/dist/leaflet.draw.css'
import { Field, useForm } from '../../components/form'
import { useLocale, type Messages } from '../../i18n'
import { ApiError } from '../../lib/http'
import { createZone } from './zonesApi'
import { MIN_ZONE_AREA_M2, polygonArea } from './zoneOccupants'
import type { Zone } from './zonesApi'
import { makeZoneSchema, zoneFields, zoneInput } from './zoneForm'
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
    setError(null)
  }

  async function create(input: ZoneInput) {
    if (!pendingPoints) return
    setError(null)
    try {
      onZoneCreated(await createZone(organizationId, siteId, floorPlanId, { ...input, points: pendingPoints }))
      setPendingPoints(null)
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'ZONE_NO_AREA' ? t.noAreaError : t.createError)
      throw err
    }
  }

  const form = pendingPoints ? (
    <NewZoneForm t={t} error={error} onSubmit={create} onCancel={handleCancel} />
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

type ZoneInput = ReturnType<typeof zoneInput>

type NewZoneFormProps = {
  t: Messages['floorPlans']['zones']
  error: string | null
  /** Rejects to keep the form open with `error`. */
  onSubmit: (input: ZoneInput) => Promise<void>
  onCancel: () => void
}

/** Name, description and status of the zone just drawn; mounted fresh for every shape. */
function NewZoneForm({ t, error, onSubmit, onCancel }: NewZoneFormProps) {
  const form = useForm({
    initialValues: { name: '', description: '', status: 'NOT_STARTED' },
    schema: makeZoneSchema(t.validation),
    onSubmit: (values) => onSubmit(zoneInput(values)),
  })
  const busy = form.isSubmitting

  return (
    <form className="fp-float form" noValidate onSubmit={form.onSubmit} aria-busy={busy}>
      <h2 className="fp-float__title">{t.newZone}</h2>
      {zoneFields(t).map((field) => (
        <Field
          key={field.name}
          config={{ ...field, name: `zone-new-${field.name}` }}
          value={form.values[field.name]}
          error={form.errors[field.name]}
          valid={form.valid[field.name]}
          disabled={busy}
          onChange={(value) => form.onChange(field.name, value)}
          onBlur={() => form.onBlur(field.name)}
        />
      ))}
      {error ? <p className="fp-float__error" role="alert">{error}</p> : null}
      <div className="fp-float__actions">
        <button type="button" className="button button--small" onClick={onCancel} disabled={busy}>
          {t.cancel}
        </button>
        <button type="submit" className="button button--small button--primary" disabled={busy} aria-busy={busy}>
          {busy ? t.saving : t.saveZone}
        </button>
      </div>
    </form>
  )
}
