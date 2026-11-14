import { useRemoteData, type RemoteData } from '../../components/data/useRemoteData'
import { getAttendance, type Attendance } from './attendanceApi'

/**
 * The Attendance of a Site: today's, or that of a past day when a date is given. Never started from a remembered answer: yesterday's list, or a "checked in"
 * from an earlier day, must not show while the request runs.
 */
export function useAttendance(organizationId: string, siteId: string, date: string | null = null): RemoteData<Attendance> {
  return useRemoteData(
    `${organizationId}:${siteId}:attendance${date ? `:${date}` : ''}`,
    () => getAttendance(organizationId, siteId, date ?? undefined),
    { remember: false },
  )
}
