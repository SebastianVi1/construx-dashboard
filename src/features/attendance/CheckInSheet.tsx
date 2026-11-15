import { useState } from 'react'
import { useRemoteData } from '../../components/data/useRemoteData'
import { Modal } from '../../components/modal'
import { Notice } from '../../components/page'
import { formatMessage, useLocale } from '../../i18n'
import { ApiError } from '../../lib/http'
import { checkIn, getCheckInZones, type CheckIn, type ZoneRef } from './attendanceApi'
import { NO_ZONE, inGoneZone, staysPut, zoneChoice, zonesByFloorPlan } from './attendanceView'
import './attendance.css'

/**
 * The check-in sheet: the Site's zones grouped by floor plan, plus "No zone". It starts on where the person
 * already is, or, before their first Check-in, on the zone the plan expects them in; picking another place
 * and confirming moves them. A failure stays in the sheet with a retry.
 */
export function CheckInSheet({ organizationId, siteId, current, expectedZone = null, membershipId, personName, onDone, onClose }: {
  organizationId: string
  siteId: string
  /** The caller's Check-in of today, when they have one. */
  current: CheckIn | null
  /** Where the plan expects the person today, when it does. */
  expectedZone?: ZoneRef | null
  /** The member to check in, when this sheet is recording for someone else. */
  membershipId?: string
  personName?: string
  onDone: (made: CheckIn) => void
  onClose: () => void
}) {
  const { messages: m } = useLocale()
  const t = m.attendance
  // Not remembered: a zone deleted since the last visit must not be offered.
  const zones = useRemoteData(`${organizationId}:${siteId}:check-in-zones`, () => getCheckInZones(organizationId, siteId), {
    remember: false,
  })
  const [choice, setChoice] = useState(() => zoneChoice(current, expectedZone))
  const [sending, setSending] = useState(false)
  const [failure, setFailure] = useState<'failed' | 'zoneGone' | null>(null)

  const groups = zonesByFloorPlan(zones.data ?? [])
  const gone = zones.data !== undefined && inGoneZone(current, zones.data)
  // In a deleted zone nothing is picked yet, so there is nothing to confirm.
  const unchanged = staysPut(current, choice)

  async function submit() {
    if (sending || unchanged) return
    setSending(true)
    setFailure(null)
    try {
      onDone(await checkIn(organizationId, siteId, choice === NO_ZONE ? null : choice, membershipId))
    } catch (error) {
      const zoneGone = choice !== NO_ZONE && error instanceof ApiError && error.status === 404
      setFailure(zoneGone ? 'zoneGone' : 'failed')
      if (zoneGone) zones.reload()
      setSending(false)
    }
  }

  function option(value: string, label: string, hint?: string) {
    return (
      <label key={value} className="check-in-sheet__option">
        <input
          type="radio"
          name="check-in-zone"
          value={value}
          checked={choice === value}
          disabled={sending}
          onChange={() => setChoice(value)}
        />
        <span className="check-in-sheet__option-text">
          <span>{label}</span>
          {hint ? <span className="check-in-sheet__hint">{hint}</span> : null}
        </span>
        {staysPut(current, value) ? (
          <span className="check-in-sheet__here">{t.here}</span>
        ) : value === expectedZone?.id ? (
          <span className="check-in-sheet__here">{t.expectedHere}</span>
        ) : null}
      </label>
    )
  }

  return (
    <Modal
      title={current ? t.moveTitle : personName ? formatMessage(t.checkInOtherTitle, { name: personName }) : t.sheetTitle}
      description={current ? t.moveDescription : personName ? t.checkInOtherDescription : t.sheetDescription}
      onClose={onClose}
    >
      <form
        className="check-in-sheet"
        aria-busy={sending}
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        {gone && current?.zone ? <Notice>{formatMessage(t.goneZoneNote, { zone: current.zone.name })}</Notice> : null}
        <div className="check-in-sheet__options" role="radiogroup" aria-label={t.zonesLabel}>
          {option(NO_ZONE, t.noZone, t.noZoneHint)}
          {groups.map((group) => (
            <fieldset key={group.floorPlanId} className="check-in-sheet__plan">
              <legend>{group.floorPlanName}</legend>
              {group.zones.map((zone) => option(zone.id, zone.name))}
            </fieldset>
          ))}
        </div>
        {zones.data === undefined && zones.status === 'error' ? (
          <Notice tone="error" action={{ label: t.retry, onClick: zones.reload }}>
            {t.zonesError}
          </Notice>
        ) : zones.data === undefined ? (
          <p className="check-in-sheet__loading" role="status">
            {t.zonesLoading}
          </p>
        ) : null}
        {failure ? (
          <Notice tone="error" action={failure === 'failed' ? { label: t.retry, onClick: () => void submit() } : undefined}>
            {failure === 'zoneGone' ? t.zoneGone : t.checkInFailed}
          </Notice>
        ) : null}
        <div className="button-row button-row--end modal-actions">
          <button type="button" className="button button--ghost" onClick={onClose} disabled={sending}>
            {t.cancel}
          </button>
          <button type="submit" className="button button--primary" disabled={sending || unchanged} aria-busy={sending}>
            {sending ? t.checkingIn : current ? t.move : t.checkIn}
          </button>
        </div>
      </form>
    </Modal>
  )
}
