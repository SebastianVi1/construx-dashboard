import { useState } from 'react'
import { useRemoteData } from '../../components/data/useRemoteData'
import { Modal } from '../../components/modal'
import { Notice } from '../../components/page'
import { formatMessage, useLocale } from '../../i18n'
import { rollCall, getCheckInZones, type RollCallCrew } from './attendanceApi'
import { NO_ZONE, rollCallMemberIds, zonesByFloorPlan } from './attendanceView'
import './attendance.css'

export function RollCallControl({ organizationId, siteId, crew, onDone }: {
  organizationId: string
  siteId: string
  crew: RollCallCrew
  onDone: () => void
}) {
  const { messages: m } = useLocale()
  const t = m.attendance
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" className="button button--small attendance-roll-call__launch" onClick={() => setOpen(true)}>
        {t.rollCall}: {crew.name}
      </button>
      {open ? (
        <RollCallSheet
          organizationId={organizationId}
          siteId={siteId}
          crew={crew}
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false)
            onDone()
          }}
        />
      ) : null}
    </>
  )
}

function RollCallSheet({ organizationId, siteId, crew, onDone, onClose }: {
  organizationId: string
  siteId: string
  crew: RollCallCrew
  onDone: () => void
  onClose: () => void
}) {
  const { messages: m } = useLocale()
  const t = m.attendance
  const zones = useRemoteData(`${organizationId}:${siteId}:check-in-zones`, () => getCheckInZones(organizationId, siteId), {
    remember: false,
  })
  const [selected, setSelected] = useState(() => new Set(rollCallMemberIds(crew)))
  const [zoneId, setZoneId] = useState(crew.expectedZone?.id ?? NO_ZONE)
  const [sending, setSending] = useState(false)
  const [failed, setFailed] = useState(false)
  const groups = zonesByFloorPlan(zones.data ?? [])

  function toggleMember(membershipId: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(membershipId)) next.delete(membershipId)
      else next.add(membershipId)
      return next
    })
  }

  async function submit() {
    if (sending || selected.size === 0) return
    setSending(true)
    setFailed(false)
    try {
      const membershipIds = crew.members
        .filter((member) => selected.has(member.membershipId) && member.checkIn === null)
        .map((member) => member.membershipId)
      await rollCall(organizationId, siteId, crew.crewId, membershipIds, zoneId === NO_ZONE ? null : zoneId)
      onDone()
    } catch {
      setFailed(true)
      setSending(false)
    }
  }

  return (
    <Modal
      title={formatMessage(t.rollCallTitle, { name: crew.name })}
      description={t.rollCallDescription}
      onClose={onClose}
    >
      <form
        className="roll-call-sheet"
        aria-busy={sending}
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <fieldset className="roll-call-sheet__roster">
          <legend>{crew.name}</legend>
          {crew.members.map((member) => {
            const present = member.checkIn !== null
            return (
              <label key={member.membershipId} className="roll-call-sheet__member">
                <input
                  type="checkbox"
                  checked={present || selected.has(member.membershipId)}
                  disabled={sending || present}
                  onChange={() => toggleMember(member.membershipId)}
                />
                <span className="roll-call-sheet__member-name">{member.name}</span>
                {present ? <span className="roll-call-sheet__present">{t.rollCallPresent}</span> : null}
              </label>
            )
          })}
        </fieldset>

        <fieldset className="roll-call-sheet__zones">
          <legend>{t.zonesLabel}</legend>
          <label className="check-in-sheet__option">
            <input
              type="radio"
              name={`roll-call-zone-${crew.crewId}`}
              value={NO_ZONE}
              checked={zoneId === NO_ZONE}
              disabled={sending}
              onChange={() => setZoneId(NO_ZONE)}
            />
            <span className="check-in-sheet__option-text">
              <span>{t.noZone}</span>
              <span className="check-in-sheet__hint">{t.noZoneHint}</span>
            </span>
          </label>
          {groups.map((group) => (
            <fieldset key={group.floorPlanId} className="check-in-sheet__plan">
              <legend>{group.floorPlanName}</legend>
              {group.zones.map((zone) => (
                <label key={zone.id} className="check-in-sheet__option">
                  <input
                    type="radio"
                    name={`roll-call-zone-${crew.crewId}`}
                    value={zone.id}
                    checked={zoneId === zone.id}
                    disabled={sending}
                    onChange={() => setZoneId(zone.id)}
                  />
                  <span className="check-in-sheet__option-text">{zone.name}</span>
                </label>
              ))}
            </fieldset>
          ))}
        </fieldset>

        {zones.data === undefined && zones.status === 'error' ? (
          <Notice tone="error" action={{ label: t.retry, onClick: zones.reload }}>{t.zonesError}</Notice>
        ) : zones.data === undefined ? (
          <p className="check-in-sheet__loading" role="status">{t.zonesLoading}</p>
        ) : null}
        {failed ? <Notice tone="error">{t.rollCallFailed}</Notice> : null}
        <div className="button-row button-row--end modal-actions">
          <button type="button" className="button button--ghost" onClick={onClose} disabled={sending}>
            {t.cancel}
          </button>
          <button
            type="submit"
            className="button button--primary"
            disabled={sending || selected.size === 0}
            aria-busy={sending}
          >
            {sending ? t.rollCallSubmitting : t.rollCallSubmit}
          </button>
        </div>
      </form>
    </Modal>
  )
}
