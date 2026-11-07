import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import L from 'leaflet'
import { useLocale } from '../../i18n'
import { useRemoteData } from '../../components/data/useRemoteData'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { usePermissions } from '../permissions'
import { getFloorPlan, viewUrlExpiresSoon } from './floorPlansApi'
import { FloorPlanViewer } from './FloorPlanViewer'
import { CalibrationTool } from './CalibrationTool'
import { ZoneLayer } from './ZoneLayer'
import { ZoneDrawTool } from './ZoneDrawTool'
import { ZonePanel } from './ZonePanel'
import { AssignmentPanel } from './AssignmentPanel'
import { AssignmentForm } from './AssignmentForm'
import { getCalibration } from './calibrationApi'
import type { Calibration } from './calibrationApi'
import { listZones } from './zonesApi'
import type { Zone } from './zonesApi'
import { getZoneAssignmentCounts } from './zoneAssignmentsApi'
import type { DraggableResource } from './zoneAssignmentsApi'
import './floor-plans.css'

export function FloorPlanPage() {
  const { siteId = '', floorPlanId = '' } = useParams()
  const { messages: m } = useLocale()
  const t = m.floorPlans
  const organization = useCurrentOrganization()

  const { can } = usePermissions()
  const canManagePlan = can('MANAGE_PLAN') ?? false

  const orgId = organization?.id ?? ''
  const remote = useRemoteData(`floor-plan-${floorPlanId}`, () => getFloorPlan(orgId, siteId, floorPlanId))
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const floorPlan = remote.data
  const shouldPoll = floorPlan?.status === 'PENDING' || floorPlan?.status === 'PROCESSING'

  const [calibrating, setCalibrating] = useState(false)
  const [calibration, setCalibration] = useState<Calibration | null>(null)
  const [calibrationLoaded, setCalibrationLoaded] = useState(false)
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null)

  // Zone state
  const [zones, setZones] = useState<Zone[]>([])
  const zonesLoadedRef = useRef(false)
  const [zonesVisible, setZonesVisible] = useState(true)
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null)
  const [zoneConflictBanner, setZoneConflictBanner] = useState(false)

  // Assignment state
  const [assignmentPanelOpen, setAssignmentPanelOpen] = useState(false)
  const [draggingResource, setDraggingResource] = useState<DraggableResource | null>(null)
  const [assignmentTarget, setAssignmentTarget] = useState<{ zone: Zone; resource: DraggableResource } | null>(null)
  const [assignmentCounts, setAssignmentCounts] = useState<Record<string, number>>({})

  // Load existing calibration when floor plan is READY
  useEffect(() => {
    if (!floorPlan || floorPlan.status !== 'READY' || calibrationLoaded) return
    setCalibrationLoaded(true)
    getCalibration(orgId, siteId, floorPlanId)
      .then((cal) => setCalibration(cal))
      .catch(() => setCalibration(null))
  }, [floorPlan, orgId, siteId, floorPlanId, calibrationLoaded])

  // Load zones when floor plan is READY and calibration exists
  useEffect(() => {
    if (!floorPlan || floorPlan.status !== 'READY' || !calibration || zonesLoadedRef.current) return
    zonesLoadedRef.current = true
    listZones(orgId, siteId, floorPlanId)
      .then((zs) => setZones(zs))
      .catch(() => setZones([]))
    getZoneAssignmentCounts(orgId, siteId, floorPlanId)
      .then((counts) => setAssignmentCounts(counts))
      .catch(() => {})
  }, [floorPlan, calibration, orgId, siteId, floorPlanId])

  const reloadAssignmentCounts = () => {
    getZoneAssignmentCounts(orgId, siteId, floorPlanId)
      .then((counts) => setAssignmentCounts(counts))
      .catch(() => {})
  }

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

  const handleRefreshNeeded = () => {
    remote.reload()
  }

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

  const handleMapReady = (map: L.Map) => {
    setMapInstance(map)
  }

  const handleCalibrated = (cal: Calibration) => {
    setCalibration(cal)
    setCalibrating(false)
  }

  const handleCancelCalibration = () => {
    setCalibrating(false)
  }

  const handleZoneCreated = (zone: Zone) => {
    setZones((prev) => [...prev, zone])
  }

  const handleZoneUpdated = (zone: Zone) => {
    setZones((prev) => prev.map((z) => (z.id === zone.id ? zone : z)))
    setSelectedZone(zone)
  }

  const handleZoneDeleted = (zoneId: string) => {
    setZones((prev) => prev.filter((z) => z.id !== zoneId))
    setSelectedZone(null)
  }

  const handleZoneConflict = () => {
    setZoneConflictBanner(true)
    setSelectedZone(null)
  }

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

      {zoneConflictBanner ? (
        <div className="floor-plan-calibration-banner" role="alert">
          <p>{t.zones.conflictWarning}</p>
          <button type="button" className="button" onClick={() => { setZoneConflictBanner(false); zonesLoadedRef.current = false; listZones(orgId, siteId, floorPlanId).then((zs) => setZones(zs)).catch(() => {}) }}>
            {t.retry}
          </button>
        </div>
      ) : null}

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
                  {hasCalibration ? (
                    <button
                      type="button"
                      className={`button${zonesVisible ? '' : ' button--muted'}`}
                      onClick={() => setZonesVisible((v) => !v)}
                    >
                      {t.zones.toggleVisibility}
                    </button>
                  ) : null}
                  {hasCalibration && canManagePlan ? (
                    <button
                      type="button"
                      className={`button${assignmentPanelOpen ? ' button--active' : ''}`}
                      onClick={() => setAssignmentPanelOpen((v) => !v)}
                    >
                      {t.assignments.panelTitle}
                    </button>
                  ) : null}
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

              {isReady && hasCalibration && mapInstance && !calibrating ? (
                <ZoneDrawTool
                  map={mapInstance}
                  metersPerPx={calibration.metersPerPx}
                  organizationId={orgId}
                  siteId={siteId}
                  floorPlanId={floorPlanId}
                  onZoneCreated={handleZoneCreated}
                />
              ) : null}

              <div className="floor-plan-layout">
                {assignmentPanelOpen ? (
                  <AssignmentPanel
                    organizationId={orgId}
                    onDragStart={(res) => setDraggingResource(res)}
                    onDragEnd={() => setDraggingResource(null)}
                  />
                ) : null}
                <div className="floor-plan-viewer-wrap">
                  <FloorPlanViewer
                    floorPlan={floorPlan}
                    onRefreshNeeded={handleRefreshNeeded}
                    onMapReady={handleMapReady}
                  />
                  {mapInstance && hasCalibration ? (
                    <ZoneLayer
                      map={mapInstance}
                      zones={zones}
                      metersPerPx={calibration.metersPerPx}
                      visible={zonesVisible}
                      onZoneClick={(zone) => {
                        if (draggingResource) {
                          setAssignmentTarget({ zone, resource: draggingResource })
                          setDraggingResource(null)
                        } else {
                          setSelectedZone(zone)
                        }
                      }}
                      assignmentCounts={assignmentCounts}
                      draggingResource={draggingResource !== null}
                      onDropOnZone={(zone) => {
                        if (draggingResource) {
                          setAssignmentTarget({ zone, resource: draggingResource })
                          setDraggingResource(null)
                        }
                      }}
                    />
                  ) : null}
                </div>
              </div>

              {assignmentTarget ? (
                <AssignmentForm
                  organizationId={orgId}
                  siteId={siteId}
                  floorPlanId={floorPlanId}
                  zoneId={assignmentTarget.zone.id}
                  resource={assignmentTarget.resource}
                  onAssigned={() => {
                    setAssignmentTarget(null)
                    reloadAssignmentCounts()
                  }}
                  onCancel={() => setAssignmentTarget(null)}
                />
              ) : null}

              {selectedZone ? (
                <ZonePanel
                  zone={selectedZone}
                  allZones={zones}
                  organizationId={orgId}
                  siteId={siteId}
                  floorPlanId={floorPlanId}
                  onUpdated={handleZoneUpdated}
                  onDeleted={handleZoneDeleted}
                  onClose={() => setSelectedZone(null)}
                  onConflict={handleZoneConflict}
                />
              ) : null}
            </>
          )}
        </>
      ) : null}
    </main>
  )
}
