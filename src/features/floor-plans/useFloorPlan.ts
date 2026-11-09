import { useEffect, useEffectEvent, useMemo } from 'react'
import { useRemoteData } from '../../components/data/useRemoteData'
import type { RemoteStatus } from '../../components/data/useRemoteData'
import { findCalibration } from './calibrationApi'
import type { Calibration } from './calibrationApi'
import { getFloorPlan } from './floorPlansApi'
import type { FloorPlan } from './floorPlansApi'
import { getFloorPlanState, localIsoDate } from './floorPlanStateApi'
import { applyZoneChange, floorPlanLoadKeys, nextPollDelay, refreshOnReturn } from './floorPlanLoading'
import type { ZoneChange } from './floorPlanLoading'
import type { AssignmentData } from './zoneAssignmentsApi'
import { zoneOccupants } from './zoneOccupants'
import type { Occupant } from './zoneOccupants'
import type { Zone } from './zonesApi'

export type FloorPlanData = {
  /** The plan, kept while it is read again (polling, URL refresh). */
  floorPlan: FloorPlan | undefined
  status: RemoteStatus
  /** Read the plan again: retry after an error, or a fresh view URL. */
  reload: () => void
  /** null = the plan is not calibrated yet. */
  calibration: Calibration | null
  calibrationStatus: RemoteStatus
  reloadCalibration: () => void
  /** Show a calibration just saved; zones and occupants load once there is one. */
  calibrated: (calibration: Calibration) => void
  zones: Zone[]
  assignments: AssignmentData[]
  occupantsByZone: Record<string, Occupant[]>
  /** Zones and today's occupants (one read); `idle` until the plan is ready and calibrated. */
  stateStatus: RemoteStatus
  /** Read zones and occupants again, after an assignment changed or a conflict. */
  reloadState: () => void
  /** Show a zone just drawn, edited or deleted without reading the plan state again. */
  applyZoneChange: (change: ZoneChange) => void
}

/**
 * Everything the floor plan page renders from: the plan (polled while it renders, re-read before
 * its image URL expires and when the tab comes back), its calibration, and its zones with today's
 * occupants. Reads are keyed by company, Site and plan, so switching any of them starts clean.
 */
export function useFloorPlan(organizationId: string, siteId: string, floorPlanId: string): FloorPlanData {
  const keysFor = (floorPlan?: FloorPlan, calibration?: Calibration | null) =>
    floorPlanLoadKeys(organizationId, siteId, floorPlanId, floorPlan, calibration)

  const plan = useRemoteData(keysFor().plan, () => getFloorPlan(organizationId, siteId, floorPlanId))
  const floorPlan = plan.data
  const calibrationRead = useRemoteData(keysFor(floorPlan).calibration, () =>
    findCalibration(organizationId, siteId, floorPlanId),
  )
  const calibration = calibrationRead.data ?? null
  const state = useRemoteData(keysFor(floorPlan, calibration).state, () =>
    getFloorPlanState(organizationId, siteId, floorPlanId, localIsoDate()),
  )

  const reloadPlan = useEffectEvent(() => plan.reload())

  // One timer: every few seconds while rendering, otherwise just before the view URL expires
  useEffect(() => {
    const delay = nextPollDelay(floorPlan, Date.now())
    if (delay === null) return
    const timer = setTimeout(reloadPlan, delay)
    return () => clearTimeout(timer)
  }, [floorPlan])

  // Timers sleep in background tabs; check again when the tab is back
  const onVisibilityChange = useEffectEvent(() => {
    if (!document.hidden && refreshOnReturn(floorPlan, Date.now())) plan.reload()
  })
  useEffect(() => {
    const listener = () => onVisibilityChange()
    document.addEventListener('visibilitychange', listener)
    return () => document.removeEventListener('visibilitychange', listener)
  }, [])

  const states = state.data
  const zones = useMemo(() => states?.map((s) => s.zone) ?? [], [states])
  const assignments = useMemo(() => states?.flatMap((s) => s.activeAssignments) ?? [], [states])
  const occupantsByZone = useMemo(() => zoneOccupants(assignments), [assignments])

  return {
    floorPlan,
    status: plan.status,
    reload: plan.reload,
    calibration,
    calibrationStatus: calibrationRead.status,
    reloadCalibration: calibrationRead.reload,
    calibrated: (saved) => {
      if (calibrationRead.status === 'ready') calibrationRead.update(() => saved)
      else calibrationRead.reload()
    },
    zones,
    assignments,
    occupantsByZone,
    stateStatus: state.status,
    reloadState: state.reload,
    applyZoneChange: (change) => state.update((current) => applyZoneChange(current, change)),
  }
}
