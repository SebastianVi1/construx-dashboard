import type { Zone } from './zonesApi'
import type { AssignmentData, DraggableResource, ReassignDrag } from './zoneAssignmentsApi'

/** Someone or something shown inside a zone on the plan. */
export type Occupant = { key: string; kind: 'person' | 'equipment'; label: string }

export type OccupantDirectory = {
  members: { membershipId: string; fullName: string | null; email: string }[]
  crews: { id: string; name: string; memberMembershipIds: string[] }[]
  equipment: { id: string; type: string; identifier: string }[]
}

/** Ray-casting test; `polygon` and `point` share the same [x, y] space. */
export function pointInPolygon([px, py]: [number, number], polygon: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** The zone under a point in metres; when zones overlap, the smallest one wins. */
export function zoneAtPoint(zones: Zone[], point: [number, number]): Zone | null {
  let best: Zone | null = null
  for (const zone of zones) {
    if (!pointInPolygon(point, zone.points)) continue
    if (!best || zone.areaMSquared < best.areaMSquared) best = zone
  }
  return best
}

/** Reads the JSON set on a drag: a resource from the panel or an assignment being moved. */
export function parseDropPayload(raw: string): DraggableResource | ReassignDrag | null {
  try {
    const data: unknown = JSON.parse(raw)
    if (typeof data !== 'object' || data === null) return null
    const d = data as Record<string, unknown>
    if (typeof d.assignmentId === 'string' && typeof d.sourceZoneId === 'string') {
      return { assignmentId: d.assignmentId, sourceZoneId: d.sourceZoneId, label: String(d.label ?? '') }
    }
    if ((d.type === 'membership' || d.type === 'crew' || d.type === 'equipment') && typeof d.id === 'string') {
      return { type: d.type, id: d.id, name: String(d.name ?? '') }
    }
    return null
  } catch {
    return null
  }
}

/**
 * One occupant per worker and per piece of equipment, grouped by zone. A crew counts as each of
 * its members; a person assigned twice to the same zone is shown once.
 */
export function zoneOccupants(assignments: AssignmentData[], directory: OccupantDirectory): Record<string, Occupant[]> {
  const memberName = new Map(directory.members.map((m) => [m.membershipId, m.fullName ?? m.email]))
  const crews = new Map(directory.crews.map((c) => [c.id, c]))
  const equipment = new Map(directory.equipment.map((e) => [e.id, e]))
  const byZone: Record<string, Occupant[]> = {}

  for (const a of assignments) {
    const list = (byZone[a.zoneId] ??= [])
    const addPerson = (membershipId: string, label: string) => {
      const key = `person:${membershipId}`
      if (!list.some((o) => o.key === key)) list.push({ key, kind: 'person', label })
    }
    if (a.membershipId) {
      addPerson(a.membershipId, memberName.get(a.membershipId) ?? '')
    } else if (a.crewId) {
      const crew = crews.get(a.crewId)
      if (!crew || crew.memberMembershipIds.length === 0) {
        list.push({ key: `crew:${a.crewId}`, kind: 'person', label: crew?.name ?? '' })
      } else {
        for (const id of crew.memberMembershipIds) addPerson(id, `${memberName.get(id) ?? ''} · ${crew.name}`)
      }
    } else if (a.equipmentId) {
      const eq = equipment.get(a.equipmentId)
      const key = `equipment:${a.equipmentId}`
      if (!list.some((o) => o.key === key)) {
        list.push({ key, kind: 'equipment', label: eq ? `${eq.type} — ${eq.identifier}` : '' })
      }
    }
  }
  return byZone
}

/** Who an assignment is for, as shown in the zone panel. */
export function assignmentLabel(a: AssignmentData, directory: OccupantDirectory): string {
  if (a.membershipId) {
    const m = directory.members.find((x) => x.membershipId === a.membershipId)
    return m ? (m.fullName ?? m.email) : ''
  }
  if (a.crewId) return directory.crews.find((c) => c.id === a.crewId)?.name ?? ''
  if (a.equipmentId) {
    const eq = directory.equipment.find((e) => e.id === a.equipmentId)
    return eq ? `${eq.type} — ${eq.identifier}` : ''
  }
  return ''
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
