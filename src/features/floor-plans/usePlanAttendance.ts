import { useRemoteData, type RemoteData } from '../../components/data/useRemoteData'
import { getAttendance, type Attendance } from '../attendance/attendanceApi'

/**
 * Today's Attendance of a Site, read only to shade the plan (see `overlayAttendance`). The key is the
 * one `useAttendance` uses without a date, so both screens share the answer. Never started from a
 * remembered answer, and never started at all until the company and the Site are known.
 */
export function usePlanAttendance(organizationId: string, siteId: string): RemoteData<Attendance> {
  return useRemoteData(
    organizationId && siteId ? `${organizationId}:${siteId}:attendance` : null,
    () => getAttendance(organizationId, siteId),
    { remember: false },
  )
}
