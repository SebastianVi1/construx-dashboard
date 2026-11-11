import type { Calibration } from './calibrationApi'
import type { FloorPlan } from './floorPlansApi'
import type { ZoneState } from './floorPlanStateApi'
import type { Zone } from './zonesApi'

/** How often a plan still being rendered is checked again. */
export const PROCESSING_POLL_MS = 3000
/** A view URL is replaced this long before it expires. */
export const VIEW_URL_MARGIN_MS = 5 * 60 * 1000
/** Floor for URL refreshes, so a URL that comes back already near expiry cannot cause a reload loop. */
export const MIN_URL_REFRESH_MS = 30_000
/** A ready plan without a view URL is an anomaly; ask again at this pace instead of waiting forever. */
export const MISSING_URL_POLL_MS = 10_000

/**
 * When the plan itself should be read again, in ms from `now`, or null when nothing will change:
 * every few seconds while it renders, otherwise shortly before its presigned view URL expires.
 */
export function nextPollDelay(floorPlan: FloorPlan | undefined, now: number): number | null {
  if (!floorPlan) return null
  if (floorPlan.status === 'PENDING' || floorPlan.status === 'PROCESSING') return PROCESSING_POLL_MS
  // A failed plan will never get an image; nothing to wait for.
  if (floorPlan.status === 'ERROR') return null
  // A ready plan without a URL must keep asking; otherwise the canvas could stay empty forever.
  if (!floorPlan.viewUrl) return MISSING_URL_POLL_MS
  if (!floorPlan.viewUrlExpiresAt) return null
  const refreshAt = Date.parse(floorPlan.viewUrlExpiresAt) - VIEW_URL_MARGIN_MS
  return Math.max(MIN_URL_REFRESH_MS, refreshAt - now)
}

/** Whether a tab coming back into view should read the plan again (timers may have slept meanwhile). */
export function refreshOnReturn(floorPlan: FloorPlan | undefined, now: number): boolean {
  if (!floorPlan) return false
  if (floorPlan.status === 'PENDING' || floorPlan.status === 'PROCESSING') return true
  if (floorPlan.status === 'ERROR') return false
  if (!floorPlan.viewUrl) return true
  if (!floorPlan.viewUrlExpiresAt) return false
  return Date.parse(floorPlan.viewUrlExpiresAt) - now < VIEW_URL_MARGIN_MS
}

export type FloorPlanLoadKeys = { plan: string | null; calibration: string | null; state: string | null }

/**
 * Which reads of a plan run, as `useRemoteData` keys (null = do not load). Each read is keyed by
 * company, Site and plan, so switching any of them drops the old answers. The calibration is read
 * once the plan is rendered; zones and occupants only once it is calibrated (`null` = not calibrated).
 */
export function floorPlanLoadKeys(
  organizationId: string,
  siteId: string,
  floorPlanId: string,
  floorPlan: FloorPlan | undefined,
  calibration: Calibration | null | undefined,
): FloorPlanLoadKeys {
  const plan = organizationId && siteId && floorPlanId ? `${organizationId}:${siteId}:${floorPlanId}` : null
  const ready = plan !== null && floorPlan?.status === 'READY'
  return {
    plan,
    calibration: ready ? plan : null,
    state: ready && calibration ? plan : null,
  }
}

export type ZoneChange =
  | { kind: 'created'; zone: Zone }
  | { kind: 'updated'; zone: Zone }
  | { kind: 'deleted'; zoneId: string }

/** The loaded plan state after a zone was saved, so drawing or editing a zone needs no reload. */
export function applyZoneChange(states: ZoneState[], change: ZoneChange): ZoneState[] {
  switch (change.kind) {
    case 'created':
      return [...states, { zone: change.zone, activeAssignments: [] }]
    case 'updated':
      return states.map((s) => (s.zone.id === change.zone.id ? { ...s, zone: change.zone } : s))
    case 'deleted':
      return states.filter((s) => s.zone.id !== change.zoneId)
  }
}
