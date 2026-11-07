import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import L from 'leaflet'
import { useLocale } from '../../i18n'
import { useRemoteData } from '../../components/data/useRemoteData'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { getFloorPlan, viewUrlExpiresSoon } from './floorPlansApi'
import { FloorPlanViewer } from './FloorPlanViewer'
import { CalibrationTool } from './CalibrationTool'
import { getCalibration } from './calibrationApi'
import type { Calibration } from './calibrationApi'
import './floor-plans.css'

export function FloorPlanPage() {
  const { siteId = '', floorPlanId = '' } = useParams()
  const { messages: m } = useLocale()
  const t = m.floorPlans
  const organization = useCurrentOrganization()

  const orgId = organization?.id ?? ''
  const remote = useRemoteData(`floor-plan-${floorPlanId}`, () => getFloorPlan(orgId, siteId, floorPlanId))
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const floorPlan = remote.data
  const shouldPoll = floorPlan?.status === 'PENDING' || floorPlan?.status === 'PROCESSING'

  const [calibrating, setCalibrating] = useState(false)
  const [calibration, setCalibration] = useState<Calibration | null>(null)
  const [calibrationLoaded, setCalibrationLoaded] = useState(false)
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null)

  // Load existing calibration when floor plan is READY
  useEffect(() => {
    if (!floorPlan || floorPlan.status !== 'READY' || calibrationLoaded) return
    setCalibrationLoaded(true)
    getCalibration(orgId, siteId, floorPlanId)
      .then((cal) => setCalibration(cal))
      .catch(() => setCalibration(null))
  }, [floorPlan, orgId, siteId, floorPlanId, calibrationLoaded])

  // Poll every 3 seconds while PENDING or PROCESSING
  useEffect(() => {
    if (shouldPoll) {
      pollingRef.current = setInterval(() => {
        remote.reload()
      }, 3000)
    } else {
      if (pollingRef.current !== null) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
    return () => {
      if (pollingRef.current !== null) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [shouldPoll, remote])

  const handleRefreshNeeded = useCallback(() => {
    remote.reload()
  }, [remote])

  // Refresh when the view URL is about to expire
  useEffect(() => {
    if (!floorPlan) return
    const interval = setInterval(() => {
      if (viewUrlExpiresSoon(floorPlan)) {
        remote.reload()
      }
    }, 60_000)
    return () => clearInterval(interval)
  }, [floorPlan, remote])

  const handleMapReady = useCallback((map: L.Map) => {
    setMapInstance(map)
  }, [])

  const handleCalibrated = useCallback((cal: Calibration) => {
    setCalibration(cal)
    setCalibrating(false)
  }, [])

  const handleCancelCalibration = useCallback(() => {
    setCalibrating(false)
  }, [])

  if (!siteId || !floorPlanId || !organization) return null

  const isReady = floorPlan?.status === 'READY'
  const hasCalibration = calibration !== null

  return (
    <main className="page-content">
      <header className="page-header">
        <nav aria-label="breadcrumb" className="breadcrumb">
          <Link to={`/sites/${encodeURIComponent(siteId)}/floor-plans`}>{t.back}</Link>
          {floorPlan ? (
            <>
              <span aria-hidden>›</span>
              <span>{floorPlan.name}</span>
            </>
          ) : null}
        </nav>
        {floorPlan ? (
          <div className="page-header__row">
            <h1>{floorPlan.name}</h1>
            <span
              className={`floor-plan-status-badge floor-plan-status-badge--${floorPlan.status.toLowerCase()}`}
              role="status"
            >
              {t.status[floorPlan.status]}
            </span>
          </div>
        ) : null}
        {floorPlan?.level ? <p className="page-header__description">{floorPlan.level}</p> : null}
        {floorPlan?.description ? <p className="page-header__description">{floorPlan.description}</p> : null}
      </header>

      {remote.status === 'loading' ? (
        <p className="loading-text">{t.loading}</p>
      ) : remote.status === 'error' ? (
        <div>
          <p className="error-text">{t.loadError}</p>
          <button type="button" className="button" onClick={() => remote.reload()}>
            {t.retry}
          </button>
        </div>
      ) : floorPlan ? (
        <>
          {floorPlan.status === 'PENDING' || floorPlan.status === 'PROCESSING' ? (
            <div className="floor-plan-processing-notice" role="status">
              <p>{floorPlan.status === 'PENDING' ? t.pendingMessage : t.processingMessage}</p>
            </div>
          ) : floorPlan.status === 'ERROR' ? (
            <div className="floor-plan-error-banner" role="alert">
              <p>{t.errorMessage}</p>
              {floorPlan.errorReason ? <p><code>{floorPlan.errorReason}</code></p> : null}
            </div>
          ) : (
            <>
              {isReady && !hasCalibration ? (
                <div className="floor-plan-calibration-banner" role="status">
                  <p>{t.calibration.notCalibrated}</p>
                </div>
              ) : null}

              {isReady ? (
                <div className="floor-plan-toolbar">
                  <button
                    type="button"
                    className={`button${calibrating ? ' button--active' : ''}`}
                    onClick={() => setCalibrating((v) => !v)}
                  >
                    {calibrating ? t.calibration.calibrating : t.calibration.calibrate}
                  </button>
                </div>
              ) : null}

              {calibrating && mapInstance ? (
                <CalibrationTool
                  map={mapInstance}
                  organizationId={orgId}
                  siteId={siteId}
                  floorPlanId={floorPlanId}
                  onCalibrated={handleCalibrated}
                  onCancel={handleCancelCalibration}
                />
              ) : null}

              <div className="floor-plan-viewer-wrap">
                <FloorPlanViewer
                  floorPlan={floorPlan}
                  onRefreshNeeded={handleRefreshNeeded}
                  onMapReady={handleMapReady}
                />
              </div>
            </>
          )}
        </>
      ) : null}
    </main>
  )
}
