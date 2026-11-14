import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { useRemoteData } from '../../components/data/useRemoteData'
import { ConfirmDialog } from '../../components/modal'
import { BackLink, Notice, SkeletonRows } from '../../components/page'
import { formatMessage, intlLocales, useLocale } from '../../i18n'
import { ApiError } from '../../lib/http'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { Avatar } from '../profile/Avatar'
import { dateText } from '../sites/siteDisplay'
import { getSite } from '../sites/sitesApi'
import { removeCheckIn, type AttendancePerson } from './attendanceApi'
import { canRemove, checkInTime, recordedBySelf, removalFailure } from './attendanceView'
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
  const [removing, setRemoving] = useState<AttendancePerson | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  // Counts removals: the Check-in control is rebuilt after one, so it forgets a Check-in it made itself.
  const [removals, setRemovals] = useState(0)

  async function confirmRemoval(person: AttendancePerson) {
    setRemoveError(null)
    try {
      await removeCheckIn(organization.id, siteId, person.checkIn.id)
      setRemoving(null)
      setRemovals((count) => count + 1)
      attendance.reload()
    } catch (error) {
      const failure = removalFailure(error)
      setRemoveError(failure === 'locked' ? t.removeLocked : failure === 'forbidden' ? t.removeForbidden : t.removeFailed)
      // The day moved on or the right is gone: the list on screen is stale either way.
      if (failure !== 'failed') attendance.reload()
    }
  }

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
        {!denied ? <CheckInControl key={removals} organizationId={organization.id} siteId={siteId} attendance={attendance} /> : null}
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
                    <span className="attendance-row__zone">
                      {person.checkIn.zone
                        ? formatMessage(t.zoneOnPlan, {
                            zone: person.checkIn.zone.name,
                            plan: person.checkIn.zone.floorPlanName,
                          })
                        : t.noZone}
                    </span>
                    <span className="attendance-row__by">
                      {recordedBySelf(person)
                        ? t.recordedBySelf
                        : formatMessage(t.recordedBy, { name: person.checkIn.recordedBy.name })}
                    </span>
                  </div>
                  <time className="attendance-row__time data-mono" dateTime={person.checkIn.checkedInAt}>
                    {formatMessage(t.time, { time: checkInTime(person.checkIn.checkedInAt, intlLocales[locale]) })}
                  </time>
                  {canRemove(data, person) ? (
                    <button
                      type="button"
                      className="button button--small attendance-row__remove"
                      aria-label={formatMessage(t.removeLabel, { name: person.name })}
                      onClick={() => {
                        setRemoveError(null)
                        setRemoving(person)
                      }}
                    >
                      {t.remove}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {removing ? (
        <ConfirmDialog
          title={t.removeTitle}
          body={formatMessage(t.removeBody, {
            name: removing.name,
            time: checkInTime(removing.checkIn.checkedInAt, intlLocales[locale]),
          })}
          confirmLabel={t.removeConfirm}
          pendingLabel={t.removing}
          cancelLabel={t.cancel}
          error={removeError}
          onConfirm={() => confirmRemoval(removing)}
          onClose={() => setRemoving(null)}
        />
      ) : null}
    </div>
  )
}
