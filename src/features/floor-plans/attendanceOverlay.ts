import type { Attendance, AttendancePerson } from '../attendance/attendanceApi'
import type { AttendanceMark, Occupant } from './zoneOccupants'

/** Where a person is drawn on the plan, and the figure holding them. */
type Position = { zoneId: string; index: number; occupant: Occupant }

function positionOf(occupantsByZone: Record<string, Occupant[]>, membershipId: string): Position | null {
  for (const [zoneId, list] of Object.entries(occupantsByZone)) {
    const index = list.findIndex((o) => o.kind === 'person' && o.resourceId === membershipId)
    if (index >= 0) return { zoneId, index, occupant: list[index] }
  }
  return null
}

/** The map with the person taken out of every zone, leaving equipment and crews with no members. */
function withoutPerson(occupantsByZone: Record<string, Occupant[]>, membershipId: string): Record<string, Occupant[]> {
  const result = { ...occupantsByZone }
  for (const [zoneId, list] of Object.entries(result)) {
    if (list.some((o) => o.kind === 'person' && o.resourceId === membershipId)) {
      result[zoneId] = list.filter((o) => !(o.kind === 'person' && o.resourceId === membershipId))
    }
  }
  return result
}

function withPerson(
  occupantsByZone: Record<string, Occupant[]>,
  zoneId: string,
  occupant: Occupant,
  index: number | null,
): Record<string, Occupant[]> {
  const list = occupantsByZone[zoneId] ?? []
  const at = index === null ? list.length : Math.min(index, list.length)
  const result = { ...occupantsByZone }
  result[zoneId] = [...list.slice(0, at), occupant, ...list.slice(at)]
  return result
}

/** A figure for someone Attendance knows and the plan state does not. */
function fromAttendance(person: AttendancePerson, mark: AttendanceMark): Occupant {
  return {
    key: `person:${person.membershipId}`,
    kind: 'person',
    label: person.name,
    resourceId: person.membershipId,
    avatarUrl: person.avatarUrl,
    attendance: mark,
  }
}

/** A figure's name with its Attendance state, as the tooltip and screen readers read it. */
export function attendanceLabel(
  label: string,
  mark: AttendanceMark | undefined,
  states: Record<AttendanceMark, string>,
): string {
  return mark === 'ABSENT' || mark === 'UNPLANNED' ? `${label} · ${states[mark]}` : label
}

/**
 * The plan's occupants with today's Attendance applied: who is really in each zone, not only who was
 * planned. Applied only when Attendance is loaded, is the backend's today, and is of the browser's day;
 * otherwise the plan is shown on its own, without any error.
 *
 * A person is drawn where they checked in: always when that zone is on this plan, and nowhere when it is
 * another plan or there is none, even if the plan expected them here. Someone expected with no Check-in is
 * drawn dimmed where they were expected. Equipment is left alone.
 */
export function overlayAttendance(
  occupantsByZone: Record<string, Occupant[]>,
  attendance: Attendance | undefined,
  /** The browser's day, as `localIsoDate` gives it. */
  today: string,
  /** The zones drawn on this floor plan; people checked in elsewhere are not drawn here. */
  zones: Array<{ id: string }>,
): Record<string, Occupant[]> {
  if (!attendance || !attendance.today || attendance.date !== today) return occupantsByZone

  const drawn = new Set(zones.map((zone) => zone.id))
  let result = occupantsByZone

  for (const person of attendance.people) {
    const expectedZoneId = person.expectedZone?.id ?? null
    const currentZoneId = person.checkIn?.zone?.id ?? null

    if (!person.checkIn) {
      if (person.state !== 'ABSENT' || !expectedZoneId || !drawn.has(expectedZoneId)) continue
      const previous = positionOf(result, person.membershipId)
      const figure = previous
        ? { ...previous.occupant, attendance: 'ABSENT' as const }
        : fromAttendance(person, 'ABSENT')
      result = withoutPerson(result, person.membershipId)
      result = withPerson(result, expectedZoneId, figure, previous?.zoneId === expectedZoneId ? previous.index : null)
      continue
    }

    const previous = positionOf(result, person.membershipId)
    // Checked in elsewhere or with no zone: they are not in the expected zone shown here.
    result = withoutPerson(result, person.membershipId)
    if (!currentZoneId || !drawn.has(currentZoneId)) continue

    const mark: AttendanceMark = currentZoneId === expectedZoneId ? 'PRESENT' : 'UNPLANNED'
    const figure = previous
      ? { ...previous.occupant, attendance: mark }
      : fromAttendance(person, mark)
    result = withPerson(result, currentZoneId, figure, previous?.zoneId === currentZoneId ? previous.index : null)
  }

  return result
}
