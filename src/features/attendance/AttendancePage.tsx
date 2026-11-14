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
import {
  attendanceGroups,
  canRemove,
  checkInTime,
  chooseDay,
  dayFailure,
  expectedElsewhere,
  recordedBySelf,
  removalFailure,
  type DayChoice,
} from './attendanceView'
import { CheckInControl } from './CheckInControl'
import { useAttendance } from './useAttendance'
import './attendance.css'

/**
 * A Site's Attendance of one day against the zone plan: present, absent and unplanned. It opens on today, the
 * day the backend returns, never the browser's; a past day picked with the date field is read-only.
 */
export function AttendancePage() {
  const { siteId = '' } = useParams()
  const { messages: m, locale } = useLocale()
  const t = m.attendance
  const organization = useCurrentOrganization()
  // Same key as the Site page, so its name is already there when arriving from it.
  const site = useRemoteData(`${organization.id}:${siteId}`, () => getSite(organization.id, siteId))
  // The day asked for; null is today, as the backend defines it.
  const [day, setDay] = useState<DayChoice>({ date: null, today: null })
  const attendance = useAttendance(organization.id, siteId, day.date)
  const siteName = site.data?.name
  const [removing, setRemoving] = useState<AttendancePerson | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  // Counts removals: the Check-in control is rebuilt after one, so it forgets a Check-in it made itself.
  const [removals, setRemovals] = useState(0)

  async function confirmRemoval(person: AttendancePerson) {
    if (!person.checkIn) return
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
  const badDate = !denied && attendance.status === 'error' && dayFailure(attendance.error) === 'badDate'
  const groups = data ? attendanceGroups(data) : null
  // Past days are read-only: nobody checks in, moves or removes there.
  const pastDay = day.date !== null

  function row(person: AttendancePerson) {
    const checkIn = person.checkIn
    const elsewhere = expectedElsewhere(person)
    return (
      <li key={person.membershipId} className={`attendance-row${checkIn ? '' : ' attendance-row--absent'}`}>
        <Avatar fullName={person.name} avatarUrl={person.avatarUrl} decorative />
        <div className="attendance-row__who">
          <span className="attendance-row__name">{person.name}</span>
          {checkIn ? (
            <span className="attendance-row__zone">
              {checkIn.zone
                ? formatMessage(t.zoneOnPlan, { zone: checkIn.zone.name, plan: checkIn.zone.floorPlanName })
                : t.noZone}
            </span>
          ) : null}
          {!checkIn && person.expectedZone ? (
            <span className="attendance-row__zone">
              {formatMessage(t.expectedIn, { zone: person.expectedZone.name, plan: person.expectedZone.floorPlanName })}
            </span>
          ) : null}
          {elsewhere ? (
            <span className="attendance-row__expected">
              {formatMessage(t.expectedIn, { zone: elsewhere.name, plan: elsewhere.floorPlanName })}
            </span>
          ) : null}
          {checkIn ? (
            <span className="attendance-row__by">
              {recordedBySelf(person) ? t.recordedBySelf : formatMessage(t.recordedBy, { name: checkIn.recordedBy.name })}
            </span>
          ) : null}
        </div>
        {checkIn ? (
          <time className="attendance-row__time data-mono" dateTime={checkIn.checkedInAt}>
            {formatMessage(t.time, { time: checkInTime(checkIn.checkedInAt, intlLocales[locale]) })}
          </time>
        ) : null}
        {data && canRemove(data, person) ? (
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
    )
  }

  function group(id: string, title: string, hint: string, people: AttendancePerson[]) {
    return (
      <section className="page-section attendance-group" aria-labelledby={`attendance-${id}-heading`}>
        <div className="page-section__header">
          <h2 id={`attendance-${id}-heading`}>
            {title} <span className="attendance-group__count data-mono">{people.length}</span>
          </h2>
          <p>{hint}</p>
        </div>
        {people.length === 0 ? (
          <p className="attendance-group__empty">{t.groupEmpty}</p>
        ) : (
          <ul className="attendance-list">{people.map(row)}</ul>
        )}
      </section>
    )
  }

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
        {!denied && !pastDay ? (
          <CheckInControl key={removals} organizationId={organization.id} siteId={siteId} attendance={attendance} />
        ) : null}
      </header>

      {!denied ? (
        <div className="attendance-picker">
          <label className="attendance-picker__field">
            <span>{t.day}</span>
            <input
              type="date"
              className="attendance-picker__input"
              // Empty until the backend has said which day is today: the browser's own date is never used.
              value={day.date ?? data?.date ?? day.today ?? ''}
              max={(data?.today ? data.date : day.today) ?? undefined}
              onChange={(event) => setDay(chooseDay(day, data, event.target.value))}
            />
          </label>
          {pastDay ? (
            <>
              <button type="button" className="button button--small attendance-picker__today" onClick={() => setDay({ ...day, date: null })}>
                {t.backToToday}
              </button>
              <p className="attendance-picker__note">{t.pastDay}</p>
            </>
          ) : null}
        </div>
      ) : null}

      {!data || !groups ? (
        attendance.status === 'error' ? (
          <Notice
            tone="error"
            action={
              denied
                ? undefined
                : badDate
                  ? { label: t.backToToday, onClick: () => setDay({ ...day, date: null }) }
                  : { label: t.retry, onClick: attendance.reload }
            }
          >
            {denied ? t.notFound : badDate ? t.badDate : t.loadError}
          </Notice>
        ) : (
          <SkeletonRows avatar />
        )
      ) : data.people.length === 0 ? (
        <div className="empty-state">
          <h2>{data.today ? t.emptyTitle : t.emptyTitlePast}</h2>
          <p>{data.today ? t.emptyBody : t.emptyBodyPast}</p>
        </div>
      ) : (
        <>
          <dl className="attendance-summary" aria-label={t.summary}>
            <div className="attendance-summary__item">
              <dt>{t.present}</dt>
              <dd className="data-mono">{groups.present.length}</dd>
            </div>
            <div className="attendance-summary__item">
              <dt>{t.absent}</dt>
              <dd className="data-mono">{groups.absent.length}</dd>
            </div>
            <div className="attendance-summary__item">
              <dt>{t.unplanned}</dt>
              <dd className="data-mono">{groups.unplanned.length}</dd>
            </div>
          </dl>
          {group('present', t.present, t.presentHint, groups.present)}
          {group('absent', t.absent, data.today ? t.absentHint : t.absentHintPast, groups.absent)}
          {group('unplanned', t.unplanned, t.unplannedHint, groups.unplanned)}
        </>
      )}

      {removing?.checkIn ? (
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
