import { useState } from 'react'
import { Form, selectedOptionValues, useForm, type FieldConfig } from '../../components/form'
import { useRemoteData } from '../../components/data/useRemoteData'
import { Modal } from '../../components/modal'
import { Notice } from '../../components/page'
import { formatMessage, useLocale } from '../../i18n'
import { rollCall, getCheckInZones, type RollCallCrew } from './attendanceApi'
import { NO_ZONE, rollCallFormSchema, rollCallMemberIds, zonesByFloorPlan } from './attendanceView'
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
  const [failed, setFailed] = useState(false)
  const form = useForm({
    initialValues: {
      membershipIds: JSON.stringify(rollCallMemberIds(crew)),
      zoneId: crew.expectedZone?.id ?? NO_ZONE,
    },
    schema: rollCallFormSchema,
    onSubmit: async ({ membershipIds, zoneId }) => {
      setFailed(false)
      try {
        const selected = new Set(selectedOptionValues(membershipIds))
        const memberIds = crew.members
          .filter((member) => selected.has(member.membershipId) && member.checkIn === null)
          .map((member) => member.membershipId)
        await rollCall(organizationId, siteId, crew.crewId, memberIds, zoneId === NO_ZONE ? null : zoneId)
        onDone()
      } catch (error) {
        setFailed(true)
        throw error
      }
    },
  })
  const groups = zonesByFloorPlan(zones.data ?? [])
  const selectedCount = selectedOptionValues(form.values.membershipIds).length
  const fields: FieldConfig[] = [
    {
      name: 'membershipIds',
      label: crew.name,
      type: 'checkboxes',
      groupClassName: 'roll-call-sheet__roster',
      optionClassName: 'roll-call-sheet__member',
      optionTextClassName: 'roll-call-sheet__member-name',
      optionStatusClassName: 'roll-call-sheet__present',
      options: crew.members.map((member) => ({
        value: member.membershipId,
        label: member.name,
        checked: member.checkIn !== null,
        disabled: member.checkIn !== null,
        statusLabel: member.checkIn !== null ? t.rollCallPresent : undefined,
      })),
    },
    {
      name: 'zoneId',
      label: t.zonesLabel,
      type: 'radio',
      groupClassName: 'roll-call-sheet__zones',
      optionClassName: 'check-in-sheet__option',
      optionTextClassName: 'check-in-sheet__option-text',
      optionDescriptionClassName: 'check-in-sheet__hint',
      optionGroups: [
        { options: [{ value: NO_ZONE, label: t.noZone, description: t.noZoneHint }] },
        ...groups.map((group) => ({
          label: group.floorPlanName,
          className: 'check-in-sheet__plan',
          options: group.zones.map((zone) => ({ value: zone.id, label: zone.name })),
        })),
      ],
    },
  ]

  return (
    <Modal
      title={formatMessage(t.rollCallTitle, { name: crew.name })}
      description={t.rollCallDescription}
      onClose={onClose}
    >
      <Form
        controller={form}
        fields={fields}
        className="roll-call-sheet"
        actionsClassName="button-row button-row--end modal-actions"
        submitClassName="button button--primary"
        submitDisabled={selectedCount === 0}
        submitLabel={t.rollCallSubmit}
        pendingLabel={t.rollCallSubmitting}
        beforeSubmit={(
          <button type="button" className="button button--ghost" onClick={onClose} disabled={form.isSubmitting}>
            {t.cancel}
          </button>
        )}
      >
        {zones.data === undefined && zones.status === 'error' ? (
          <Notice tone="error" action={{ label: t.retry, onClick: zones.reload }}>{t.zonesError}</Notice>
        ) : zones.data === undefined ? (
          <p className="check-in-sheet__loading" role="status">{t.zonesLoading}</p>
        ) : null}
        {failed ? <Notice tone="error">{t.rollCallFailed}</Notice> : null}
      </Form>
    </Modal>
  )
}
