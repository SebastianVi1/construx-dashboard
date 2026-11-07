import { useEffect, useState } from 'react'
import { z } from 'zod'
import { useRemoteData } from '../../components/data/useRemoteData'
import { Field, useForm } from '../../components/form'
import { Notice, SkeletonList } from '../../components/page'
import { formatMessage, useLocale } from '../../i18n'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { usePermissions } from '../permissions'
import {
  createEquipment,
  deleteEquipment,
  listEquipment,
  updateEquipment,
  type Equipment,
} from './crewsApi'
import './crews.css'

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

  return <EquipmentContent orgId={orgId} canManage={can('MANAGE_PLAN')} />
}

function EquipmentContent({ orgId, canManage }: { orgId: string; canManage: boolean }) {
  const { messages: m } = useLocale()
  const t = m.equipment

  const equipment = useRemoteData(`${orgId}:equipment`, () => listEquipment(orgId))

  const [showCreate, setShowCreate] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleCreate(type: string, identifier: string, dailyCostCents: number | null) {
    setBusy(true)
    try {
      const item = await createEquipment(orgId, { type, identifier, dailyCostCents })
      equipment.update((prev) => [...(prev ?? []), item])
      setShowCreate(false)
      setNotice(t.created)
    } catch {
      setNotice(t.error.generic)
    } finally {
      setBusy(false)
    }
  }

  async function handleToggleActive(item: Equipment) {
    try {
      const updated = await updateEquipment(orgId, item.id, { active: !item.active })
      equipment.update((prev) => prev?.map((e) => (e.id === item.id ? updated : e)) ?? [])
      setNotice(updated.active ? t.reactivated : t.deactivated)
    } catch {
      setNotice(t.error.generic)
    }
  }

  async function handleDelete(item: Equipment) {
    if (!confirm(formatMessage(t.deleteBody, { identifier: item.identifier }))) return
    try {
      await deleteEquipment(orgId, item.id)
      equipment.update((prev) => prev?.filter((e) => e.id !== item.id) ?? [])
      setNotice(t.deleted)
    } catch {
      setNotice(t.error.generic)
    }
  }

  if (equipment.status === 'loading') return <div className="page"><SkeletonList /></div>
  if (equipment.status === 'error') return <div className="page"><Notice>{t.loadError}</Notice></div>

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
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
          busy={busy}
        />
      )}

      {equipment.data?.length === 0 ? (
        <p className="equipment-empty">{t.empty}</p>
      ) : (
        <table className="equipment-table">
          <thead>
            <tr>
              <th>{t.type}</th>
              <th>{t.identifier}</th>
              <th>{t.dailyCost}</th>
              <th>{t.active}</th>
              {canManage && <th />}
            </tr>
          </thead>
          <tbody>
            {equipment.data?.map((item) => (
              <tr key={item.id} className={item.active ? '' : 'equipment-row--inactive'}>
                <td>{item.type}</td>
                <td>{item.identifier}</td>
                <td>{item.dailyCostCents != null ? formatCost(item.dailyCostCents) : '—'}</td>
                <td>
                  <span className={`equipment-badge ${item.active ? 'equipment-badge--active' : 'equipment-badge--inactive'}`}>
                    {item.active ? t.active : t.inactive}
                  </span>
                </td>
                {canManage && (
                  <td className="equipment-actions">
                    <button
                      type="button"
                      className="button button--sm"
                      onClick={() => handleToggleActive(item)}
                    >
                      {item.active ? t.deactivate : t.reactivate}
                    </button>
                    <button
                      type="button"
                      className="button button--danger button--sm"
                      onClick={() => handleDelete(item)}
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
  busy,
}: {
  onSubmit: (type: string, identifier: string, dailyCostCents: number | null) => void
  onCancel: () => void
  busy: boolean
}) {
  const { messages: m } = useLocale()
  const t = m.equipment

  const schema = z.object({
    type: z.string().min(1, t.validation.typeRequired).max(80, t.validation.typeMax),
    identifier: z.string().min(1, t.validation.identifierRequired).max(80, t.validation.identifierMax),
    dailyCost: z.string().refine(
      (v) => v === '' || (Number.isInteger(Number(v)) && Number(v) >= 0),
      t.validation.dailyCostInvalid,
    ),
  })

  const form = useForm({
    initialValues: { type: '', identifier: '', dailyCost: '' },
    schema,
    onSubmit: async (values) => {
      const costCents = values.dailyCost.trim() ? Number(values.dailyCost) : null
      onSubmit(values.type.trim(), values.identifier.trim(), costCents)
    },
  })

  return (
    <div className="dialog-overlay">
      <form className="dialog" onSubmit={form.onSubmit} noValidate>
        <h2>{t.add}</h2>
        <Field
          config={{ name: 'type', label: t.type, placeholder: t.typePlaceholder }}
          value={form.values.type}
          error={form.errors.type}
          valid={form.valid.type}
          disabled={busy}
          onChange={(v) => form.onChange('type', v)}
          onBlur={() => form.onBlur('type')}
        />
        <Field
          config={{ name: 'identifier', label: t.identifier, placeholder: t.identifierPlaceholder }}
          value={form.values.identifier}
          error={form.errors.identifier}
          valid={form.valid.identifier}
          disabled={busy}
          onChange={(v) => form.onChange('identifier', v)}
          onBlur={() => form.onBlur('identifier')}
        />
        <Field
          config={{ name: 'dailyCost', label: t.dailyCost, type: 'number', placeholder: t.dailyCostPlaceholder, min: '0' }}
          value={form.values.dailyCost}
          error={form.errors.dailyCost}
          valid={form.valid.dailyCost}
          disabled={busy}
          onChange={(v) => form.onChange('dailyCost', v)}
          onBlur={() => form.onBlur('dailyCost')}
        />
        <div className="dialog-actions">
          <button type="button" className="button" onClick={onCancel} disabled={busy}>
            {t.cancel}
          </button>
          <button type="submit" className="button button--primary" disabled={busy || form.isSubmitting}>
            {t.add}
          </button>
        </div>
      </form>
    </div>
  )
}

function formatCost(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}
