import { useState } from 'react'
import type { RemoteData } from '../../components/data/useRemoteData'
import { Notice } from '../../components/page'
import { formatMessage, intlLocales, useLocale } from '../../i18n'
import { checkIn, type Attendance, type CheckIn } from './attendanceApi'
import { checkInTime, myCheckIn } from './attendanceView'
import './attendance.css'

/**
 * The "Check in" button of a Site. Once the caller is checked in today it turns into the time of the Check-in.
 * A failure is shown inline with a retry; nothing is queued for later.
 */
export function CheckInControl({ organizationId, siteId, attendance }: {
  organizationId: string
  siteId: string
  attendance: RemoteData<Attendance>
}) {
  const { messages: m, locale } = useLocale()
  const t = m.attendance
  const [sending, setSending] = useState(false)
  const [failed, setFailed] = useState(false)
  // Shown until the reloaded Attendance carries the Check-in; ignored once the backend's day has moved on.
  const [made, setMade] = useState<CheckIn | null>(null)

  const day = attendance.data?.date
  const current = myCheckIn(attendance.data) ?? (made && (day === undefined || day === made.date) ? made : null)

  async function submit() {
    setSending(true)
    setFailed(false)
    try {
      setMade(await checkIn(organizationId, siteId))
      attendance.reload()
    } catch {
      setFailed(true)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="check-in">
      {current ? (
        <p className="check-in__done" role="status">
          <span className="check-in__mark" aria-hidden="true" />
          {formatMessage(t.checkedInAt, { time: checkInTime(current.checkedInAt, intlLocales[locale]) })}
        </p>
      ) : (
        <button
          type="button"
          className="button button--primary check-in__button"
          // Until today's Attendance answers, it is unknown whether the caller already checked in.
          disabled={sending || attendance.status === 'loading'}
          aria-busy={sending}
          onClick={() => void submit()}
        >
          {sending ? t.checkingIn : t.checkIn}
        </button>
      )}
      {failed && !current ? (
        <Notice tone="error" action={{ label: t.retry, onClick: () => void submit() }}>
          {t.checkInFailed}
        </Notice>
      ) : null}
    </div>
  )
}
