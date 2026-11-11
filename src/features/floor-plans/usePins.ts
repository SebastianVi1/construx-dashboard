import { useRemoteData, type RemoteStatus } from '../../components/data/useRemoteData'
import { listPins, type Pin, type PinFilters } from './pinsApi'

export type PinsState = {
  pins: Pin[]
  status: RemoteStatus
  reload: () => void
  /** Put a created or changed pin in the list without reading it again. */
  upsert: (pin: Pin) => void
  remove: (pinId: string) => void
}

/** The pins of one plan under the list's filters; a filter change reads again. */
export function usePins(organizationId: string, siteId: string, floorPlanId: string, filters: PinFilters): PinsState {
  const key =
    organizationId && siteId && floorPlanId
      ? `${organizationId}:${siteId}:${floorPlanId}:${filters.kind ?? ''}:${filters.assignee ?? ''}:${filters.zoneId ?? ''}`
      : null
  const read = useRemoteData(key, () => listPins(organizationId, siteId, floorPlanId, filters))

  return {
    pins: read.data ?? [],
    status: read.status,
    reload: read.reload,
    upsert: (pin) =>
      read.update((current) =>
        current.some((p) => p.id === pin.id) ? current.map((p) => (p.id === pin.id ? pin : p)) : [pin, ...current],
      ),
    remove: (pinId) => read.update((current) => current.filter((p) => p.id !== pinId)),
  }
}
