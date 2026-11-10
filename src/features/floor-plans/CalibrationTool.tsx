import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { useLocale } from '../../i18n'
import { saveCalibration } from './calibrationApi'
import type { Calibration } from './calibrationApi'
import { Field } from '../../components/form'

interface CalibrationToolProps {
  map: L.Map
  organizationId: string
  siteId: string
  floorPlanId: string
  onCalibrated: (calibration: Calibration) => void
  onCancel: () => void
}

type ToolState = 'firstPoint' | 'secondPoint' | 'enterDistance'

export function CalibrationTool({
  map,
  organizationId,
  siteId,
  floorPlanId,
  onCalibrated,
  onCancel,
}: CalibrationToolProps) {
  const { messages: m } = useLocale()
  const t = m.floorPlans.calibration

  const [state, setState] = useState<ToolState>('firstPoint')
  const [distance, setDistance] = useState('')
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const pointARef = useRef<L.LatLng | null>(null)
  const pointBRef = useRef<L.LatLng | null>(null)
  const markerARef = useRef<L.CircleMarker | null>(null)
  const markerBRef = useRef<L.CircleMarker | null>(null)
  const lineRef = useRef<L.Polyline | null>(null)

  // Set crosshair cursor while in calibration mode
  useEffect(() => {
    const container = map.getContainer()
    container.style.cursor = 'crosshair'
    return () => {
      container.style.cursor = ''
    }
  }, [map])

  // Click handler
  useEffect(() => {
    const dangerColor = getComputedStyle(document.documentElement).getPropertyValue('--cx-danger').trim()

    function onClick(e: L.LeafletMouseEvent) {
      if (state === 'firstPoint') {
        pointARef.current = e.latlng
        if (markerARef.current) markerARef.current.remove()
        markerARef.current = L.circleMarker(e.latlng, {
          radius: 6,
          color: dangerColor,
          fill: true,
          fillColor: dangerColor,
          fillOpacity: 1,
        }).addTo(map)
        setState('secondPoint')
      } else if (state === 'secondPoint') {
        pointBRef.current = e.latlng
        if (markerBRef.current) markerBRef.current.remove()
        markerBRef.current = L.circleMarker(e.latlng, {
          radius: 6,
          color: dangerColor,
          fill: true,
          fillColor: dangerColor,
          fillOpacity: 1,
        }).addTo(map)
        if (lineRef.current) lineRef.current.remove()
        lineRef.current = L.polyline([pointARef.current!, e.latlng], {
          color: dangerColor,
          dashArray: '8 4',
          weight: 2,
        }).addTo(map)
        setState('enterDistance')
      }
    }

    map.on('click', onClick)
    return () => {
      map.off('click', onClick)
    }
  }, [map, state])

  // Cleanup markers/line on unmount
  useEffect(() => {
    return () => {
      markerARef.current?.remove()
      markerBRef.current?.remove()
      lineRef.current?.remove()
    }
  }, [])

  function handleCancel() {
    markerARef.current?.remove()
    markerBRef.current?.remove()
    lineRef.current?.remove()
    onCancel()
  }

  // A real distance between the two points: more than 0, up to 3 decimals (millimetres).
  const distanceIssue = Number(distance) > 0 ? null : t.zeroDistanceError

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (saving || distanceIssue) return
    const parsed = Number(distance)
    setSaveError('')
    setSaving(true)
    try {
      const a = pointARef.current!
      const b = pointBRef.current!
      const result = await saveCalibration(organizationId, siteId, floorPlanId, {
        pointAX: a.lng,
        pointAY: a.lat,
        pointBX: b.lng,
        pointBY: b.lat,
        lengthMeters: parsed,
      })
      onCalibrated(result)
    } catch {
      setSaveError(m.floorPlans.error.generic)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={state === 'enterDistance' ? 'fp-float calibration-tool' : 'fp-hint calibration-tool'}>
      {state === 'firstPoint' || state === 'secondPoint' ? (
        <p className="calibration-tool__hint" role="status">
          {state === 'firstPoint' ? t.calibrating : t.secondPoint}
        </p>
      ) : null}

      {state === 'enterDistance' ? (
        <form onSubmit={handleSubmit} className="form" noValidate>
          <h2 className="fp-float__title">{t.calibrate}</h2>
          <Field
            config={{
              name: 'calibration-distance',
              label: t.distanceLabel,
              type: 'number',
              decimals: 3,
              maxDigits: 6,
              suffix: 'm',
              placeholder: t.distancePlaceholder,
            }}
            value={distance}
            error={touched && distanceIssue ? distanceIssue : undefined}
            valid={!distanceIssue}
            disabled={saving}
            onChange={(value) => {
              setDistance(value)
              setTouched(true)
            }}
          />
          {saveError ? (
            <p className="fp-float__error" role="alert">
              {saveError}
            </p>
          ) : null}
          <div className="fp-float__actions">
            <button type="button" className="button button--small" onClick={handleCancel} disabled={saving}>
              {t.cancel}
            </button>
            <button type="submit" className="button button--small button--primary" disabled={saving} aria-busy={saving}>
              {saving ? m.floorPlans.dialog.confirming : t.save}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="fp-hint__action" onClick={handleCancel}>
          {t.cancel}
        </button>
      )}
    </div>
  )
}
