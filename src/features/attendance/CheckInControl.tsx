import { useState } from 'react'
import type { RemoteData } from '../../components/data/useRemoteData'
import { formatMessage, intlLocales, useLocale } from '../../i18n'
import type { Attendance, CheckIn } from './attendanceApi'
import { checkInTime, currentCheckIn } from './attendanceView'
import { CheckInSheet } from './CheckInSheet'
import './attendance.css'

/**
 * The "Check in" button of a Site. It opens the check-in sheet; once the caller is checked in today it shows
 * their current zone and the time, and still opens the sheet so they can move. Nothing is queued for later:
 * a failure is shown in the sheet with a retry.
 */
export function CheckInControl({ organizationId, siteId, attendance }: {
  organizationId: string
  siteId: string
  attendance: RemoteData<Attendance>
}) {
  const { messages: m, locale } = useLocale()
  const t = m.attendance
  const [open, setOpen] = useState(false)
  // Shown until the reloaded Attendance carries the Check-in; ignored once the backend's day has moved on.
  const [made, setMade] = useState<CheckIn | null>(null)

  const current = currentCheckIn(attendance.data, made)
  const time = current ? checkInTime(current.checkedInAt, intlLocales[locale]) : ''
  const zone = current?.zone?.name ?? t.noZone

  return (
    <div className="check-in">
      {current ? (
        <button
          type="button"
          className="button check-in__button check-in__button--done"
          aria-haspopup="dialog"
          aria-label={formatMessage(t.changeZone, { zone, time })}
          onClick={() => setOpen(true)}
        >
          <span className="check-in__mark" aria-hidden="true" />
          <span className="check-in__where">{formatMessage(t.checkedInZone, { zone, time })}</span>
        </button>
      ) : (
        <button
          type="button"
          className="button button--primary check-in__button"
          aria-haspopup="dialog"
          // Until today's Attendance answers, it is unknown whether the caller already checked in.
          disabled={attendance.status === 'loading' && !attendance.data}
          onClick={() => setOpen(true)}
        >
          {t.checkIn}
        </button>
      )}
      {open ? (
        <CheckInSheet
          organizationId={organizationId}
          siteId={siteId}
          current={current}
          onClose={() => setOpen(false)}
          onDone={(checkIn) => {
            setMade(checkIn)
            setOpen(false)
            attendance.reload()
          }}
        />
      ) : null}
    </div>
  )
}
