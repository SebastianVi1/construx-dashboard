import { useCallback, useEffect, useRef, useState } from 'react'
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
import { OccupantBubble } from './OccupantBubble'
import { getCalibration } from './calibrationApi'
import type { Calibration } from './calibrationApi'
import type { Zone } from './zonesApi'
import { createAssignment, reassignToZone } from './zoneAssignmentsApi'
import type { AssignmentData, DraggableResource, ReassignDrag } from './zoneAssignmentsApi'
import { getFloorPlanState, localIsoDate } from './floorPlanStateApi'
import { memberName, occupantAnchorKey, zoneOccupants } from './zoneOccupants'
import type { Occupant } from './zoneOccupants'
import { ScaleIcon } from './floorPlanIcons'
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
  const [stateError, setStateError] = useState(false)

  // Assignment state
  const [draggingResource, setDraggingResource] = useState<DraggableResource | null>(null)
  const [draggingReassign, setDraggingReassign] = useState<ReassignDrag | null>(null)
  const [assignError, setAssignError] = useState(false)
  const [assignments, setAssignments] = useState<AssignmentData[]>([])
  const [overlayHost, setOverlayHost] = useState<HTMLDivElement | null>(null)
  const [selectedOccupant, setSelectedOccupant] = useState<{ zone: Zone; occupant: Occupant } | null>(null)

  // Load existing calibration when floor plan is READY
  useEffect(() => {
    if (!floorPlan || floorPlan.status !== 'READY' || calibrationLoaded) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCalibrationLoaded(true)
    getCalibration(orgId, siteId, floorPlanId)
      .then((cal) => setCalibration(cal))
      .catch(() => setCalibration(null))
  }, [floorPlan, orgId, siteId, floorPlanId, calibrationLoaded])

  // Zones and today's assignments in one read; occupants come named, so no members list is needed
  const loadState = useCallback(() => {
    getFloorPlanState(orgId, siteId, floorPlanId, localIsoDate())
      .then((states) => {
        setZones(states.map((s) => s.zone))
        setAssignments(states.flatMap((s) => s.activeAssignments))
        setStateError(false)
      })
      .catch(() => setStateError(true))
  }, [orgId, siteId, floorPlanId])

  // Load zones when floor plan is READY and calibration exists
  useEffect(() => {
    if (!floorPlan || floorPlan.status !== 'READY' || !calibration || zonesLoadedRef.current) return
    zonesLoadedRef.current = true
    loadState()
  }, [floorPlan, calibration, loadState])

  const reloadAssignments = loadState

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

  // Refresh when the view URL is about to expire.
  // Also re-checks on tab restore so a backgrounded tab never shows a broken image.
  useEffect(() => {
    if (!floorPlan) return

    function checkRefresh() {
      if (viewUrlExpiresSoon(floorPlan!)) remote.reload()
    }

    function onVisibilityChange() {
      if (!document.hidden) checkRefresh()
    }

    const interval = setInterval(checkRefresh, 60_000)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
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
  const showRoster = hasCalibration && canManagePlan

  return (
    <div className="page page--wide">
      <header className="page-header">
        <div className="page-header__text">
          <nav aria-label="breadcrumb">
            <Link className="page-back" to={`/sites/${encodeURIComponent(siteId)}?tab=plans`}>{t.back}</Link>
          </nav>
          {floorPlan ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h1>{floorPlan.name}</h1>
              <span
                className={`floor-plan-status-badge floor-plan-status-badge--${floorPlan.status.toLowerCase()}`}
                role="status"
              >
                {t.status[floorPlan.status]}
              </span>
            </div>
          ) : null}
          {floorPlan?.level ? <p>{floorPlan.level}</p> : null}
          {floorPlan?.description ? <p>{floorPlan.description}</p> : null}
        </div>
      </header>

      {assignError ? (
        <div className="floor-plan-notice" role="alert">
          <p>{t.assignments.error}</p>
          <button type="button" className="button" onClick={() => setAssignError(false)}>
            {t.assignments.dismiss}
          </button>
        </div>
      ) : null}

      {stateError ? (
        <div className="floor-plan-notice" role="alert">
          <p>{t.zones.stateError}</p>
          <button type="button" className="button" onClick={loadState}>
            {t.retry}
          </button>
        </div>
      ) : null}

      {zoneConflictBanner ? (
        <div className="floor-plan-notice" role="alert">
          <p>{t.zones.conflictWarning}</p>
          <button type="button" className="button" onClick={() => { setZoneConflictBanner(false); loadState() }}>
            {t.retry}
          </button>
        </div>
      ) : null}

      {remote.status === 'loading' ? (
        <div className="loading-state"><span className="loading-state__spinner" aria-hidden />{t.loading}</div>
      ) : remote.status === 'error' ? (
        <div className="empty-state">
          <p>{t.loadError}</p>
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
              <section
                className={`floor-plan-workspace${showRoster ? ' floor-plan-workspace--roster' : ''}`}
                aria-label={floorPlan.name}
              >
                {isReady ? (
                  <div className="floor-plan-toolbar" role="toolbar" aria-label={t.zones.toolsLabel}>
                    <div className="floor-plan-toolbar__group">
                      <button
                        type="button"
                        className="fp-tool"
                        aria-pressed={calibrating}
                        onClick={() => setCalibrating((v) => !v)}
                      >
                        <ScaleIcon />
                        {t.calibration.calibrate}
                      </button>
                    </div>
                    {isReady && hasCalibration && mapInstance && !calibrating ? (
                      <ZoneDrawTool
                        map={mapInstance}
                        metersPerPx={calibration.metersPerPx}
                        organizationId={orgId}
                        siteId={siteId}
                        floorPlanId={floorPlanId}
                        onZoneCreated={handleZoneCreated}
                        overlayHost={overlayHost}
                      />
                    ) : null}
                    {hasCalibration ? (
                      <div className="floor-plan-toolbar__group floor-plan-toolbar__group--end">
                        <button
                          type="button"
                          className="fp-switch"
                          aria-pressed={zonesVisible}
                          onClick={() => setZonesVisible((v) => !v)}
                        >
                          <span className="fp-switch__track" aria-hidden />
                          {t.zones.toggleVisibility}
                        </button>
                      </div>
                    ) : (
                      <p className="floor-plan-toolbar__note" role="status">{t.calibration.notCalibrated}</p>
                    )}
                  </div>
                ) : null}

                {showRoster ? (
                  <AssignmentPanel
                    organizationId={orgId}
                    siteId={siteId}
                    onDragStart={(res) => setDraggingResource(res)}
                    onDragEnd={() => setDraggingResource(null)}
                  />
                ) : null}

                <div className="floor-plan-canvas">
                  <FloorPlanViewer
                    floorPlan={floorPlan}
                    onRefreshNeeded={handleRefreshNeeded}
                    onMapReady={handleMapReady}
                  />
                  {/* Floating cards over the plan (drawing, calibration); tools portal into it */}
                  <div ref={setOverlayHost} className="floor-plan-canvas__overlay">
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
                  </div>
                  {mapInstance && hasCalibration ? (
                    <ZoneLayer
                      map={mapInstance}
                      zones={zones}
                      metersPerPx={calibration.metersPerPx}
                      visible={zonesVisible}
                      onZoneClick={(zone) => setSelectedZone(zone)}
                      onOccupantClick={(zone, occupant) =>
                        // A second click on the same figure closes its bubble
                        setSelectedOccupant((prev) =>
                          prev && occupantAnchorKey(prev.zone, prev.occupant) === occupantAnchorKey(zone, occupant)
                            ? null
                            : { zone, occupant },
                        )
                      }
                      activeOccupantKey={
                        selectedOccupant ? occupantAnchorKey(selectedOccupant.zone, selectedOccupant.occupant) : null
                      }
                      occupants={zoneOccupants(assignments)}
                      dragging={draggingResource !== null || draggingReassign !== null}
                      onDropResource={(zone, resource) => {
                        setDraggingResource(null)
                        setAssignError(false)
                        createAssignment(orgId, siteId, floorPlanId, zone.id, {
                          membershipId: resource.type === 'membership' ? resource.id : null,
                          crewId: resource.type === 'crew' ? resource.id : null,
                          equipmentId: resource.type === 'equipment' ? resource.id : null,
                        })
                          .then(() => reloadAssignments())
                          .catch(() => setAssignError(true))
                      }}
                      onReassignDrop={(targetZone, drag) => {
                        setDraggingReassign(null)
                        if (targetZone.id === drag.sourceZoneId) return
                        reassignToZone(orgId, siteId, floorPlanId, drag.sourceZoneId, drag.assignmentId, targetZone.id)
                          .then(() => reloadAssignments())
                          .catch(() => setAssignError(true))
                      }}
                    />
                  ) : null}
                </div>

                {selectedZone ? (
                  <ZonePanel
                    key={selectedZone.id}
                    zone={selectedZone}
                    allZones={zones}
                    organizationId={orgId}
                    siteId={siteId}
                    floorPlanId={floorPlanId}
                    onUpdated={handleZoneUpdated}
                    onDeleted={handleZoneDeleted}
                    onClose={() => setSelectedZone(null)}
                    onConflict={handleZoneConflict}
                    onReassignDragStart={(drag) => setDraggingReassign(drag)}
                    onReassignDragEnd={() => setDraggingReassign(null)}
                    onAssignmentsChanged={reloadAssignments}
                    nameFor={(id) => memberName(id, assignments)}
                  />
                ) : (
                  <aside className="zone-panel zone-panel--empty">
                    <p>{hasCalibration ? t.zones.inspectorEmpty : t.calibration.notCalibrated}</p>
                  </aside>
                )}
              </section>

              {selectedOccupant ? (
                <OccupantBubble
                  key={occupantAnchorKey(selectedOccupant.zone, selectedOccupant.occupant)}
                  getAnchor={() => {
                    const key = occupantAnchorKey(selectedOccupant.zone, selectedOccupant.occupant)
                    return (
                      mapInstance
                        ?.getContainer()
                        .querySelector(`[data-occupant-key="${CSS.escape(key)}"]`) ?? null
                    )
                  }}
                  occupant={selectedOccupant.occupant}
                  zone={selectedOccupant.zone}
                  zones={zones}
                  assignments={assignments}
                  onClose={() => setSelectedOccupant(null)}
                />
              ) : null}

            </>
          )}
        </>
      ) : null}
    </div>
  )
}
