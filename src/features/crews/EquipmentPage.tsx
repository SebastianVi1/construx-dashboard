import { useEffect, useRef, useState } from 'react'
import { useRemoteData } from '../../components/data/useRemoteData'
import { Form, TEXT_LIMITS, useForm } from '../../components/form'
import { ConfirmDialog, Modal } from '../../components/modal'
import { Notice, SkeletonBlock, SkeletonRegion } from '../../components/page'
import { useCurrency } from '../../currency'
import { formatMessage, useLocale } from '../../i18n'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { usePermissions } from '../permissions'
import {
  createEquipment,
  deleteEquipment,
  listEquipment,
  updateEquipment,
  type Equipment,
  type CreateEquipmentRequest,
} from './crewsApi'
import { dailyCostCents, makeEquipmentSchema, prefilledDailyCost } from './equipmentForm'
import { ResourcePicker } from '../prices/ResourcePicker'
import type { Resource } from '../prices/pricesApi'
import './crews.css'

const EQUIPMENT_RATES = ['EQUIPMENT'] as const

export function EquipmentPage() {
  const { messages: m } = useLocale()
  const t = m.equipment
  const { can } = usePermissions()
  const organization = useCurrentOrganization()
  const orgId = organization.id

  useEffect(() => {
    document.title = `${t.title} | Construx`
  }, [t.title])

  if (!can('VIEW_PLAN')) {
    return (
      <div className="page">
        <Notice>{t.forbidden}</Notice>
      </div>
    )
  }

  return <EquipmentContent orgId={orgId} canManage={can('MANAGE_PLAN')} canPickRate={can('VIEW_PRICES')} />
}

function EquipmentContent({ orgId, canManage, canPickRate }: { orgId: string; canManage: boolean; canPickRate: boolean }) {
  const { messages: m } = useLocale()
  const { money } = useCurrency()
  const t = m.equipment

  const equipment = useRemoteData(`${orgId}:equipment`, () => listEquipment(orgId))

  const [showCreate, setShowCreate] = useState(false)
  const [deleting, setDeleting] = useState<Equipment | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // The row whose activate/deactivate request is in flight; the ref also stops a second click before re-render.
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const toggling = useRef(false)

  async function handleCreate(input: CreateEquipmentRequest) {
    const item = await createEquipment(orgId, input)
    equipment.update((prev) => [...(prev ?? []), item])
    setShowCreate(false)
    setNotice(t.created)
  }

  async function handleToggleActive(item: Equipment) {
    if (toggling.current) return
    toggling.current = true
    setTogglingId(item.id)
    try {
      const updated = await updateEquipment(orgId, item.id, { active: !item.active })
      equipment.update((prev) => prev?.map((e) => (e.id === item.id ? updated : e)) ?? [])
      setNotice(updated.active ? t.reactivated : t.deactivated)
    } catch {
      setNotice(t.error.generic)
    } finally {
      toggling.current = false
      setTogglingId(null)
    }
  }

  /** Sends the linked rate again without a daily cost, so the backend recomputes 8 hours of its current cost. */
  async function handleRefreshFromRate(item: Equipment) {
    if (toggling.current || !item.equipmentRate) return
    toggling.current = true
    setTogglingId(item.id)
    try {
      const updated = await updateEquipment(orgId, item.id, { equipmentRateResourceId: item.equipmentRate.id })
      equipment.update((prev) => prev?.map((e) => (e.id === item.id ? updated : e)) ?? [])
      setNotice(t.refreshed)
    } catch {
      setNotice(t.error.generic)
    } finally {
      toggling.current = false
      setTogglingId(null)
    }
  }

  async function handleDelete(item: Equipment) {
    try {
      await deleteEquipment(orgId, item.id)
      equipment.update((prev) => prev?.filter((e) => e.id !== item.id) ?? [])
      setDeleting(null)
      setNotice(t.deleted)
    } catch {
      setDeleteError(t.error.generic)
    }
  }


  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__text">
          <h1>{t.title}</h1>
          <p>{t.description}</p>
        </div>
        {canManage && (
          <button type="button" className="button button--primary" onClick={() => setShowCreate(true)}>
            {t.add}
          </button>
        )}
      </header>

      {notice && <Notice tone="success">{notice}</Notice>}

      {showCreate && (
        <CreateEquipmentDialog
          orgId={orgId}
          canPickRate={canPickRate}
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title={t.deleteTitle}
          body={formatMessage(t.deleteBody, { identifier: deleting.identifier })}
          confirmLabel={t.deleteConfirm}
          pendingLabel={t.deleting}
          cancelLabel={t.cancel}
          error={deleteError}
          onConfirm={() => handleDelete(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}

      {equipment.status === 'error' ? <Notice>{t.loadError}</Notice> : !equipment.data ? (
        <SkeletonRegion className="skeleton-screen">
          <table className="equipment-table" aria-hidden="true">
            <thead><tr>{[t.type, t.identifier, t.dailyCost, t.rate, t.active, ...(canManage ? [''] : [])].map((label, i) => <th key={i}>{label}</th>)}</tr></thead>
            <tbody>{Array.from({ length: 8 }, (_, row) => <tr key={row}>
              {Array.from({ length: canManage ? 6 : 5 }, (_, column) => <td key={column}><SkeletonBlock height={36} width="75%" /></td>)}
            </tr>)}</tbody>
          </table>
        </SkeletonRegion>
      ) : equipment.data.length === 0 ? (
        <p className="equipment-empty">{t.empty}</p>
      ) : (
        <table className="equipment-table">
          <thead>
            <tr>
              <th>{t.type}</th>
              <th>{t.identifier}</th>
              <th>{t.dailyCost}</th>
              <th>{t.rate}</th>
              <th>{t.active}</th>
              {canManage && <th />}
            </tr>
          </thead>
          <tbody>
            {equipment.data?.map((item) => (
              <tr key={item.id} className={item.active ? '' : 'equipment-row--inactive'}>
                <td>{item.type}</td>
                <td>{item.identifier}</td>
                <td className="data-mono">{item.dailyCostCents != null ? money(item.dailyCostCents / 100) : '—'}</td>
                <td>
                  {item.equipmentRate ? (
                    <span title={item.equipmentRate.name}>
                      {formatMessage(t.rateValue, {
                        code: item.equipmentRate.code,
                        hourlyCost: item.equipmentRate.hourlyCost != null ? money(Number(item.equipmentRate.hourlyCost)) : '—',
                      })}
                    </span>
                  ) : '—'}
                </td>
                <td>
                  <span className={`equipment-badge ${item.active ? 'equipment-badge--active' : 'equipment-badge--inactive'}`}>
                    {item.active ? t.active : t.inactive}
                  </span>
                </td>
                {canManage && (
                  <td className="equipment-actions">
                    {item.equipmentRate?.hourlyCost != null ? (
                      <button
                        type="button"
                        className="button button--sm"
                        disabled={togglingId !== null}
                        aria-label={formatMessage(t.refreshFromRateLabel, { identifier: item.identifier })}
                        onClick={() => void handleRefreshFromRate(item)}
                      >
                        {t.refreshFromRate}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="button button--sm"
                      disabled={togglingId !== null}
                      aria-busy={togglingId === item.id}
                      onClick={() => void handleToggleActive(item)}
                    >
                      {togglingId === item.id ? t.saving : item.active ? t.deactivate : t.reactivate}
                    </button>
                    <button
                      type="button"
                      className="button button--danger button--sm"
                      disabled={togglingId === item.id}
                      onClick={() => {
                        setDeleteError(null)
                        setDeleting(item)
                      }}
                    >
                      {t.delete}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function CreateEquipmentDialog({
  onSubmit,
  onCancel,
  orgId,
  canPickRate,
}: {
  /** Rejects to keep the dialog open with an error. */
  onSubmit: (input: CreateEquipmentRequest) => Promise<void>
  onCancel: () => void
  orgId: string
  /** Searching the Catalog needs VIEW_PRICES; without it the rate link is not offered. */
  canPickRate: boolean
}) {
  const { messages: m } = useLocale()
  const money = useCurrency()
  const t = m.equipment
  const [rate, setRate] = useState<Resource | null>(null)
  // The daily cost the rate filled in; left untouched, the backend computes it exactly from the rate.
  const [prefilled, setPrefilled] = useState<string | null>(null)

  const form = useForm({
    initialValues: { type: '', identifier: '', dailyCost: '' },
    schema: makeEquipmentSchema(t.validation, money),
    onSubmit: async (values) => {
      const fromRate = rate !== null && prefilled !== null && values.dailyCost === prefilled
      await onSubmit({
        type: values.type.trim(),
        identifier: values.identifier.trim(),
        ...(fromRate ? {} : { dailyCostCents: dailyCostCents(values.dailyCost, money) }),
        equipmentRateResourceId: rate?.id ?? null,
      })
    },
  })

  function pickRate(picked: Resource | null) {
    setRate(picked)
    if (!picked) return
    const filled = prefilledDailyCost(form.values.dailyCost, picked.currentCost, money)
    if (filled !== form.values.dailyCost) {
      form.onChange('dailyCost', filled)
      setPrefilled(filled)
    }
  }

  return (
    <Modal title={t.add} onClose={onCancel}>
      {canPickRate ? (
        <div className="equipment-rate-picker">
          <ResourcePicker
            organizationId={orgId}
            types={EQUIPMENT_RATES}
            value={rate}
            label={t.rateLabel}
            onChange={pickRate}
          />
          <p className="form-field__hint">{t.rateHint}</p>
        </div>
      ) : null}
      <Form
        controller={form}
        fields={[
          {
            name: 'type',
            label: t.type,
            placeholder: t.typePlaceholder,
            autoComplete: 'off',
            maxLength: TEXT_LIMITS.equipmentType,
          },
          {
            name: 'identifier',
            label: t.identifier,
            placeholder: t.identifierPlaceholder,
            autoComplete: 'off',
            maxLength: TEXT_LIMITS.equipmentIdentifier,
          },
          {
            name: 'dailyCost',
            label: formatMessage(t.dailyCostLabel, { currency: money.currency }),
            type: 'money',
            placeholder: t.dailyCostPlaceholder,
          },
        ]}
        submitLabel={t.add}
        pendingLabel={t.adding}
      >
        {form.submitError ? (
          <p className="form-error" role="alert">
            {t.error.generic}
          </p>
        ) : null}
      </Form>
      <div className="button-row button-row--end modal-actions">
        <button type="button" className="button" onClick={onCancel} disabled={form.isSubmitting}>
          {t.cancel}
        </button>
      </div>
    </Modal>
  )
}
