import { useEffect, useState } from 'react'
import { useRemoteData } from '../../components/data/useRemoteData'
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
  const [type, setType] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [dailyCost, setDailyCost] = useState('')
  const [errors, setErrors] = useState<{ type?: string; identifier?: string; dailyCost?: string }>({})

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!type.trim()) errs.type = t.validation.typeRequired
    else if (type.trim().length > 80) errs.type = t.validation.typeMax
    if (!identifier.trim()) errs.identifier = t.validation.identifierRequired
    else if (identifier.trim().length > 80) errs.identifier = t.validation.identifierMax
    let costCents: number | null = null
    if (dailyCost.trim()) {
      const parsed = Number(dailyCost)
      if (!Number.isInteger(parsed) || parsed < 0) {
        errs.dailyCost = t.validation.dailyCostInvalid
      } else {
        costCents = parsed
      }
    }
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    onSubmit(type.trim(), identifier.trim(), costCents)
  }

  return (
    <div className="dialog-overlay">
      <form className="dialog" onSubmit={submit}>
        <h2>{t.add}</h2>
        <label className="field">
          <span>{t.type}</span>
          <input
            type="text"
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder={t.typePlaceholder}
            maxLength={80}
          />
          {errors.type && <span className="field-error">{errors.type}</span>}
        </label>
        <label className="field">
          <span>{t.identifier}</span>
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={t.identifierPlaceholder}
            maxLength={80}
          />
          {errors.identifier && <span className="field-error">{errors.identifier}</span>}
        </label>
        <label className="field">
          <span>{t.dailyCost}</span>
          <input
            type="number"
            value={dailyCost}
            onChange={(e) => setDailyCost(e.target.value)}
            placeholder={t.dailyCostPlaceholder}
            min="0"
          />
          {errors.dailyCost && <span className="field-error">{errors.dailyCost}</span>}
        </label>
        <div className="dialog-actions">
          <button type="button" className="button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="button button--primary" disabled={busy}>
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
