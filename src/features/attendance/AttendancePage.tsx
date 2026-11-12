import { useEffect } from 'react'
import { useParams } from 'react-router'
import { useRemoteData } from '../../components/data/useRemoteData'
import { BackLink, Notice, SkeletonRows } from '../../components/page'
import { formatMessage, intlLocales, useLocale } from '../../i18n'
import { ApiError } from '../../lib/http'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { Avatar } from '../profile/Avatar'
import { dateText } from '../sites/siteDisplay'
import { getSite } from '../sites/sitesApi'
import { checkInTime, recordedBySelf } from './attendanceView'
import { CheckInControl } from './CheckInControl'
import { useAttendance } from './useAttendance'
import './attendance.css'

/** Who is present on a Site today. The day is the one the backend returns, never the browser's. */
export function AttendancePage() {
  const { siteId = '' } = useParams()
  const { messages: m, locale } = useLocale()
  const t = m.attendance
  const organization = useCurrentOrganization()
  // Same key as the Site page, so its name is already there when arriving from it.
  const site = useRemoteData(`${organization.id}:${siteId}`, () => getSite(organization.id, siteId))
  const attendance = useAttendance(organization.id, siteId)
  const siteName = site.data?.name

  useEffect(() => {
    document.title = `${t.title}${siteName ? ` · ${siteName}` : ''} | Construx`
  }, [siteName, t.title])

  const data = attendance.data
  const denied = attendance.error instanceof ApiError && [403, 404].includes(attendance.error.status ?? 0)

  return (
    <div className="page attendance-page">
      <BackLink to={`/sites/${encodeURIComponent(siteId)}`}>{t.back}</BackLink>

      <header className="page-header">
        <div className="page-header__text">
          <h1>{t.title}</h1>
          <p>{siteName ?? t.description}</p>
          {data ? (
            <p className="attendance-day">
              <span className="data-mono">{dateText(data.date, locale)}</span>
              {data.today ? <span className="attendance-day__today">{t.today}</span> : null}
            </p>
          ) : null}
        </div>
        {!denied ? <CheckInControl organizationId={organization.id} siteId={siteId} attendance={attendance} /> : null}
      </header>

      {!data ? (
        attendance.status === 'error' ? (
          <Notice tone="error" action={denied ? undefined : { label: t.retry, onClick: attendance.reload }}>
            {denied ? t.notFound : t.loadError}
          </Notice>
        ) : (
          <SkeletonRows avatar />
        )
      ) : (
        <section className="page-section" aria-labelledby="attendance-present-heading">
          <div className="page-section__header">
            <h2 id="attendance-present-heading">{t.present}</h2>
            <p className="data-mono">{formatMessage(t.presentCount, { count: data.people.length })}</p>
          </div>
          {data.people.length === 0 ? (
            <div className="empty-state">
              <h2>{t.emptyTitle}</h2>
              <p>{t.emptyBody}</p>
            </div>
          ) : (
            <ul className="attendance-list">
              {data.people.map((person) => (
                <li key={person.membershipId} className="attendance-row">
                  <Avatar fullName={person.name} avatarUrl={person.avatarUrl} decorative />
                  <div className="attendance-row__who">
                    <span className="attendance-row__name">{person.name}</span>
                    <span className="attendance-row__by">
                      {recordedBySelf(person)
                        ? t.recordedBySelf
                        : formatMessage(t.recordedBy, { name: person.checkIn.recordedBy.name })}
                    </span>
                  </div>
                  <time className="attendance-row__time data-mono" dateTime={person.checkIn.checkedInAt}>
                    {formatMessage(t.time, { time: checkInTime(person.checkIn.checkedInAt, intlLocales[locale]) })}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
