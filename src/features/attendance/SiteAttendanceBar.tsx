import { Link } from 'react-router'
import { useLocale } from '../../i18n'
import { attendanceUrl } from './attendanceView'
import { CheckInControl } from './CheckInControl'
import { useAttendance } from './useAttendance'

/** On the Site page: check in, and the way to the Site's Attendance. */
export function SiteAttendanceBar({ organizationId, siteId }: { organizationId: string; siteId: string }) {
  const { messages: m } = useLocale()
  const attendance = useAttendance(organizationId, siteId)

  return (
    <div className="site-attendance-bar">
      <CheckInControl organizationId={organizationId} siteId={siteId} attendance={attendance} />
      <Link className="button site-attendance-bar__link" to={attendanceUrl(siteId)}>
        {m.attendance.open}
      </Link>
    </div>
  )
}
