import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { useLocale } from '../../i18n'
import { saveCalibration } from './calibrationApi'
import type { Calibration } from './calibrationApi'

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
  const { messages: m, locale } = useLocale()
  const t = m.floorPlans.calibration

  const [state, setState] = useState<ToolState>('firstPoint')
  const [distance, setDistance] = useState('')
  const [distanceError, setDistanceError] = useState('')
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
    function onClick(e: L.LeafletMouseEvent) {
      if (state === 'firstPoint') {
        pointARef.current = e.latlng
        if (markerARef.current) markerARef.current.remove()
        markerARef.current = L.circleMarker(e.latlng, {
          radius: 6,
          color: '#e44',
          fill: true,
          fillColor: '#e44',
          fillOpacity: 1,
        }).addTo(map)
        setState('secondPoint')
      } else if (state === 'secondPoint') {
        pointBRef.current = e.latlng
        if (markerBRef.current) markerBRef.current.remove()
        markerBRef.current = L.circleMarker(e.latlng, {
          radius: 6,
          color: '#e44',
          fill: true,
          fillColor: '#e44',
          fillOpacity: 1,
        }).addTo(map)
        if (lineRef.current) lineRef.current.remove()
        lineRef.current = L.polyline([pointARef.current!, e.latlng], {
          color: '#e44',
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseFloat(distance)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setDistanceError(t.zeroDistanceError)
      return
    }
    setDistanceError('')
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
    <div className="calibration-tool-panel">
      {state === 'firstPoint' || state === 'secondPoint' ? (
        <p className="calibration-tool-panel__hint">
          {state === 'firstPoint'
            ? t.calibrating
            : locale === 'es'
              ? 'Haz clic en el segundo punto.'
              : 'Click the second point.'}
        </p>
      ) : null}

      {state === 'enterDistance' ? (
        <form onSubmit={handleSubmit} className="calibration-tool-panel__form">
          <label htmlFor="calibration-distance" className="calibration-tool-panel__label">
            {t.distanceLabel}
          </label>
          <input
            id="calibration-distance"
            type="number"
            min="0.001"
            step="any"
            className="calibration-tool-panel__input"
            placeholder={t.distancePlaceholder}
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            autoFocus
          />
          {distanceError ? (
            <p className="calibration-tool-panel__error" role="alert">
              {distanceError}
            </p>
          ) : null}
          {saveError ? (
            <p className="calibration-tool-panel__error" role="alert">
              {saveError}
            </p>
          ) : null}
          <div className="calibration-tool-panel__actions">
            <button type="submit" className="button" disabled={saving}>
              {saving ? m.floorPlans.dialog.confirming : t.save}
            </button>
            <button type="button" className="button button--ghost" onClick={handleCancel}>
              {t.cancel}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="button button--ghost" onClick={handleCancel}>
          {t.cancel}
        </button>
      )}
    </div>
  )
}
