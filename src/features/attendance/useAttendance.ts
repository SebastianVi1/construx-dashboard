import { useRemoteData, type RemoteData } from '../../components/data/useRemoteData'
import { getAttendance, type Attendance } from './attendanceApi'

/**
 * Today's Attendance of a Site. Never started from a remembered answer: yesterday's list, or a "checked in"
 * from an earlier day, must not show while the request runs.
 */
export function useAttendance(organizationId: string, siteId: string): RemoteData<Attendance> {
  return useRemoteData(`${organizationId}:${siteId}:attendance`, () => getAttendance(organizationId, siteId), {
    remember: false,
  })
}
