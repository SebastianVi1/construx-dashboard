import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import L from 'leaflet'
import { useLocale } from '../../i18n'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { usePermissions } from '../permissions'
import { FloorPlanViewer } from './FloorPlanViewer'
import { CalibrationTool } from './CalibrationTool'
import { ZoneLayer } from './ZoneLayer'
import { ZoneDrawTool } from './ZoneDrawTool'
import { ZonePanel } from './ZonePanel'
import { AssignmentPanel } from './AssignmentPanel'
import { OccupantBubble } from './OccupantBubble'
import type { Calibration } from './calibrationApi'
import type { Zone } from './zonesApi'
import { createAssignment, reassignToZone } from './zoneAssignmentsApi'
import type { DraggableResource, ReassignDrag } from './zoneAssignmentsApi'
import { memberName, occupantAnchorKey } from './zoneOccupants'
import type { Occupant } from './zoneOccupants'
import { useFloorPlan } from './useFloorPlan'
import { PinIcon, ScaleIcon } from './floorPlanIcons'
import { PinLayer } from './PinLayer'
import { PinAddTool } from './PinAddTool'
import { PinSheet, type PinSheetMode } from './PinSheet'
import { PinListPanel, type PinListFilters } from './PinListPanel'
import { usePins } from './usePins'
import { visiblePins } from './pinForm'
import type { Pin } from './pinsApi'
import './floor-plans.css'

export function FloorPlanPage() {
  const { siteId = '', floorPlanId = '' } = useParams()
  const { messages: m } = useLocale()
  const t = m.floorPlans
  const organization = useCurrentOrganization()

  const { can } = usePermissions()
  const canManagePlan = can('MANAGE_PLAN') ?? false

  const orgId = organization?.id ?? ''
  const plan = useFloorPlan(orgId, siteId, floorPlanId)
  const { floorPlan, calibration, zones, assignments } = plan

  const [calibrating, setCalibrating] = useState(false)
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null)

  // Zone state
  const [zonesVisible, setZonesVisible] = useState(true)
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null)
  const [zoneConflictBanner, setZoneConflictBanner] = useState(false)

  // Pin state: the list's filters also decide which pins the plan shows
  const [pinsVisible, setPinsVisible] = useState(true)
  const [pinFilters, setPinFilters] = useState<PinListFilters>({ showClosed: false })
  const [addingPin, setAddingPin] = useState(false)
  const [pinSheet, setPinSheet] = useState<PinSheetMode | null>(null)
  const pins = usePins(orgId, siteId, floorPlanId, pinFilters)
  const shownPins = visiblePins(pins.pins, pinFilters)

  // Assignment state
  const [draggingResource, setDraggingResource] = useState<DraggableResource | null>(null)
  const [draggingReassign, setDraggingReassign] = useState<ReassignDrag | null>(null)
  const [assignError, setAssignError] = useState(false)
  // One drop at a time: a second drop while the first is saving would assign or move twice.
  const dropping = useRef(false)

  function saveDrop(request: () => Promise<unknown>, reload: () => void) {
    if (dropping.current) return
    dropping.current = true
    setAssignError(false)
    request()
      .then(reload)
      .catch(() => setAssignError(true))
      .finally(() => {
        dropping.current = false
      })
  }
  const [overlayHost, setOverlayHost] = useState<HTMLDivElement | null>(null)
  const [selectedOccupant, setSelectedOccupant] = useState<{ zone: Zone; occupant: Occupant } | null>(null)

  const handleMapReady = (map: L.Map) => {
    setMapInstance(map)
  }

  const handleCalibrated = (cal: Calibration) => {
    plan.calibrated(cal)
    setCalibrating(false)
  }

  const handleCancelCalibration = () => {
    setCalibrating(false)
  }

  const handleZoneCreated = (zone: Zone) => {
    plan.applyZoneChange({ kind: 'created', zone })
  }

  const handleZoneUpdated = (zone: Zone) => {
    plan.applyZoneChange({ kind: 'updated', zone })
    setSelectedZone(zone)
  }

  const handleZoneDeleted = (zoneId: string) => {
    plan.applyZoneChange({ kind: 'deleted', zoneId })
    setSelectedZone(null)
  }

  const handleZoneConflict = () => {
    setZoneConflictBanner(true)
    setSelectedZone(null)
  }

  const handlePinPlaced = (x: number, y: number) => {
    setAddingPin(false)
    setSelectedZone(null)
    setPinSheet({ kind: 'create', x, y })
  }

  const openPin = (pin: Pin, center: boolean) => {
    setAddingPin(false)
    setPinSheet({ kind: 'view', pinId: pin.id })
    if (center) mapInstance?.panTo([pin.y, pin.x])
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

      {plan.calibrationStatus === 'error' ? (
        <div className="floor-plan-notice" role="alert">
          <p>{t.calibration.loadError}</p>
          <button type="button" className="button" onClick={plan.reloadCalibration}>
            {t.retry}
          </button>
        </div>
      ) : null}

      {plan.stateStatus === 'error' ? (
        <div className="floor-plan-notice" role="alert">
          <p>{t.zones.stateError}</p>
          <button type="button" className="button" onClick={plan.reloadState}>
            {t.retry}
          </button>
        </div>
      ) : null}

      {zoneConflictBanner ? (
        <div className="floor-plan-notice" role="alert">
          <p>{t.zones.conflictWarning}</p>
          <button type="button" className="button" onClick={() => { setZoneConflictBanner(false); plan.reloadState() }}>
            {t.retry}
          </button>
        </div>
      ) : null}

      {/* Polls and URL refreshes keep the plan on screen; only a first read shows the spinner */}
      {!floorPlan && plan.status === 'loading' ? (
        <div className="loading-state"><span className="loading-state__spinner" aria-hidden />{t.loading}</div>
      ) : plan.status === 'error' ? (
        <div className="empty-state">
          <p>{t.loadError}</p>
          <button type="button" className="button" onClick={plan.reload}>
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
                className={`floor-plan-workspace${showRoster ? ' floor-plan-workspace--roster' : ''}${
                  pinSheet ? ' floor-plan-workspace--sheet' : ''
                }`}
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
                    <div className="floor-plan-toolbar__group floor-plan-toolbar__group--pins">
                      <button
                        type="button"
                        className="fp-tool"
                        aria-pressed={addingPin}
                        disabled={!mapInstance || calibrating}
                        onClick={() => setAddingPin((v) => !v)}
                      >
                        <PinIcon />
                        {t.pins.add}
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
                    {hasCalibration ? null : (
                      <p className="floor-plan-toolbar__note" role="status">{t.calibration.notCalibrated}</p>
                    )}
                    <div className="floor-plan-toolbar__group floor-plan-toolbar__group--end">
                      <button
                        type="button"
                        className="fp-switch"
                        aria-pressed={pinsVisible}
                        onClick={() => setPinsVisible((v) => !v)}
                      >
                        <span className="fp-switch__track" aria-hidden />
                        {t.pins.toggleVisibility}
                      </button>
                      {hasCalibration ? (
                        <button
                          type="button"
                          className="fp-switch"
                          aria-pressed={zonesVisible}
                          onClick={() => setZonesVisible((v) => !v)}
                        >
                          <span className="fp-switch__track" aria-hidden />
                          {t.zones.toggleVisibility}
                        </button>
                      ) : null}
                    </div>
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
                      onZoneClick={(zone) => {
                        // While a pin is being placed, a tap on a zone places the pin there
                        if (addingPin) return
                        setPinSheet(null)
                        setSelectedZone(zone)
                      }}
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
                      occupants={plan.occupantsByZone}
                      avoidPins={pinsVisible ? shownPins : undefined}
                      dragging={draggingResource !== null || draggingReassign !== null}
                      onDropResource={(zone, resource) => {
                        setDraggingResource(null)
                        saveDrop(
                          () =>
                            createAssignment(orgId, siteId, floorPlanId, zone.id, {
                              membershipId: resource.type === 'membership' ? resource.id : null,
                              crewId: resource.type === 'crew' ? resource.id : null,
                              equipmentId: resource.type === 'equipment' ? resource.id : null,
                            }),
                          plan.reloadState,
                        )
                      }}
                      onReassignDrop={(targetZone, drag) => {
                        setDraggingReassign(null)
                        if (targetZone.id === drag.sourceZoneId) return
                        saveDrop(
                          () => reassignToZone(orgId, siteId, floorPlanId, drag.sourceZoneId, drag.assignmentId, targetZone.id),
                          plan.reloadState,
                        )
                      }}
                    />
                  ) : null}
                  {mapInstance ? (
                    <PinLayer
                      map={mapInstance}
                      pins={shownPins}
                      visible={pinsVisible}
                      selectedId={pinSheet?.kind === 'view' ? pinSheet.pinId : null}
                      draft={pinSheet?.kind === 'create' ? pinSheet : null}
                      labelOf={(pin) => pin.title ?? t.pins.kind[pin.kind]}
                      onPinClick={(pin) => openPin(pin, false)}
                    />
                  ) : null}
                  {mapInstance && addingPin ? (
                    <PinAddTool
                      map={mapInstance}
                      overlayHost={overlayHost}
                      onPlaced={handlePinPlaced}
                      onCancel={() => setAddingPin(false)}
                    />
                  ) : null}
                </div>

                {pinSheet ? (
                  <PinSheet
                    mode={pinSheet}
                    organizationId={orgId}
                    siteId={siteId}
                    floorPlanId={floorPlanId}
                    canManagePlan={canManagePlan}
                    onSaved={(pin) => {
                      pins.upsert(pin)
                      // Assigning an issue also places the person in the pin's zone
                      if (pin.assignee) plan.reloadState()
                      setPinSheet({ kind: 'view', pinId: pin.id })
                    }}
                    onDeleted={(pinId) => {
                      pins.remove(pinId)
                      setPinSheet(null)
                    }}
                    onClose={() => setPinSheet(null)}
                    nameFor={(id) => memberName(id, assignments)}
                  />
                ) : selectedZone ? (
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
                    onAssignmentsChanged={plan.reloadState}
                    nameFor={(id) => memberName(id, assignments)}
                  />
                ) : (
                  <PinListPanel
                    pins={shownPins}
                    status={pins.status}
                    zones={zones}
                    filters={pinFilters}
                    onFiltersChange={setPinFilters}
                    onSelect={(pin) => openPin(pin, true)}
                    onRetry={pins.reload}
                  />
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
