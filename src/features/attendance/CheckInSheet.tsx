import { useRef, useState } from 'react'
import { Form, useForm, type FieldConfig } from '../../components/form'
import { useRemoteData } from '../../components/data/useRemoteData'
import { Modal } from '../../components/modal'
import { Notice } from '../../components/page'
import { formatMessage, useLocale } from '../../i18n'
import { ApiError } from '../../lib/http'
import { checkIn, getCheckInZones, type CheckIn, type ZoneRef } from './attendanceApi'
import { NO_ZONE, checkInFormSchema, inGoneZone, staysPut, zoneChoice, zonesByFloorPlan } from './attendanceView'
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
  const formRef = useRef<HTMLFormElement>(null)
  // Not remembered: a zone deleted since the last visit must not be offered.
  const zones = useRemoteData(`${organizationId}:${siteId}:check-in-zones`, () => getCheckInZones(organizationId, siteId), {
    remember: false,
  })
  const form = useForm({
    initialValues: { zoneId: zoneChoice(current, expectedZone) },
    schema: checkInFormSchema,
    onSubmit: async ({ zoneId }) => {
      setFailure(null)
      try {
        onDone(await checkIn(organizationId, siteId, zoneId === NO_ZONE ? null : zoneId, membershipId))
      } catch (error) {
        const zoneGone = zoneId !== NO_ZONE && error instanceof ApiError && error.status === 404
        setFailure(zoneGone ? 'zoneGone' : 'failed')
        if (zoneGone) zones.reload()
        throw error
      }
    },
  })
  const [failure, setFailure] = useState<'failed' | 'zoneGone' | null>(null)

  const groups = zonesByFloorPlan(zones.data ?? [])
  const gone = zones.data !== undefined && inGoneZone(current, zones.data)
  // In a deleted zone nothing is picked yet, so there is nothing to confirm.
  const choice = form.values.zoneId
  const unchanged = staysPut(current, choice)
  const fields: FieldConfig[] = [{
    name: 'zoneId',
    label: t.zonesLabel,
    type: 'radio',
    groupClassName: 'check-in-sheet__options',
    groupLabelClassName: 'visually-hidden',
    optionClassName: 'check-in-sheet__option',
    optionTextClassName: 'check-in-sheet__option-text',
    optionDescriptionClassName: 'check-in-sheet__hint',
    optionStatusClassName: 'check-in-sheet__here',
    optionGroups: [
      {
        options: [{
          value: NO_ZONE,
          label: t.noZone,
          description: t.noZoneHint,
          statusLabel: staysPut(current, NO_ZONE) ? t.here : undefined,
        }],
      },
      ...groups.map((group) => ({
        label: group.floorPlanName,
        className: 'check-in-sheet__plan',
        options: group.zones.map((zone) => ({
          value: zone.id,
          label: zone.name,
          statusLabel: staysPut(current, zone.id) ? t.here : zone.id === expectedZone?.id ? t.expectedHere : undefined,
        })),
      })),
    ],
  }]

  return (
    <Modal
      title={current ? t.moveTitle : personName ? formatMessage(t.checkInOtherTitle, { name: personName }) : t.sheetTitle}
      description={current ? t.moveDescription : personName ? t.checkInOtherDescription : t.sheetDescription}
      onClose={onClose}
    >
      <Form
        controller={form}
        fields={fields}
        className="check-in-sheet"
        formRef={formRef}
        actionsClassName="button-row button-row--end modal-actions"
        submitClassName="button button--primary"
        submitDisabled={unchanged}
        submitLabel={current ? t.move : t.checkIn}
        pendingLabel={t.checkingIn}
        beforeFields={gone && current?.zone ? <Notice>{formatMessage(t.goneZoneNote, { zone: current.zone.name })}</Notice> : null}
        beforeSubmit={(
          <button type="button" className="button button--ghost" onClick={onClose} disabled={form.isSubmitting}>
            {t.cancel}
          </button>
        )}
      >
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
          <Notice tone="error" action={failure === 'failed' ? { label: t.retry, onClick: () => formRef.current?.requestSubmit() } : undefined}>
            {failure === 'zoneGone' ? t.zoneGone : t.checkInFailed}
          </Notice>
        ) : null}
      </Form>
    </Modal>
  )
}
