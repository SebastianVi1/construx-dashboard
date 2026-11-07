import { useState } from 'react'
import { useLocale } from '../../i18n'
import { updateZone, deleteZone } from './zonesApi'
import type { Zone, ZoneStatus } from './zonesApi'

interface ZonePanelProps {
  zone: Zone
  organizationId: string
  siteId: string
  floorPlanId: string
  onUpdated: (zone: Zone) => void
  onDeleted: (zoneId: string) => void
  onClose: () => void
  onConflict: () => void
}

/** Side panel for viewing, editing, and deleting a selected zone. */
export function ZonePanel({
  zone,
  organizationId,
  siteId,
  floorPlanId,
  onUpdated,
  onDeleted,
  onClose,
  onConflict,
}: ZonePanelProps) {
  const { messages: m } = useLocale()
  const t = m.floorPlans.zones

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(zone.name)
  const [description, setDescription] = useState(zone.description ?? '')
  const [status, setStatus] = useState<ZoneStatus>(zone.status)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const updated = await updateZone(organizationId, siteId, floorPlanId, zone.id, {
        name: name.trim(),
        description: description.trim() || null,
        status,
        points: zone.points,
        version: zone.version,
      })
      onUpdated(updated)
      setEditing(false)
    } catch (err: unknown) {
      const apiError = err as { status?: number }
      if (apiError?.status === 409) {
        onConflict()
      } else {
        setError(t.updateError)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)
    try {
      await deleteZone(organizationId, siteId, floorPlanId, zone.id)
      onDeleted(zone.id)
    } catch {
      setError(t.deleteError)
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const handleCancelEdit = () => {
    setName(zone.name)
    setDescription(zone.description ?? '')
    setStatus(zone.status)
    setError(null)
    setEditing(false)
  }

  return (
    <aside className="zone-panel">
      <div className="zone-panel__header">
        <h2 className="zone-panel__title">{zone.name}</h2>
        <button type="button" className="zone-panel__close" onClick={onClose} aria-label={t.close}>
          ×
        </button>
      </div>

      {!editing ? (
        <>
          <dl className="zone-panel__details">
            <dt>{t.statusLabel}</dt>
            <dd>
              <span className={`zone-status-badge zone-status-badge--${zone.status.toLowerCase()}`}>
                {t.status[zone.status]}
              </span>
            </dd>
            <dt>{t.areaLabel}</dt>
            <dd>{zone.areaMSquared.toFixed(1)} m²</dd>
            <dt>{t.perimeterLabel}</dt>
            <dd>{zone.perimeterMeters.toFixed(1)} m</dd>
            {zone.description ? (
              <>
                <dt>{t.descriptionLabel}</dt>
                <dd>{zone.description}</dd>
              </>
            ) : null}
          </dl>
          {error ? <p className="error-text">{error}</p> : null}
          {confirmDelete ? (
            <div className="zone-panel__confirm-delete">
              <p>{t.deleteConfirmBody}</p>
              <div className="zone-panel__actions">
                <button
                  type="button"
                  className="button button--danger"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? t.deleting : t.deleteConfirm}
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                >
                  {t.cancel}
                </button>
              </div>
            </div>
          ) : (
            <div className="zone-panel__actions">
              <button type="button" className="button button--primary" onClick={() => setEditing(true)}>
                {t.edit}
              </button>
              <button
                type="button"
                className="button button--danger"
                onClick={() => setConfirmDelete(true)}
              >
                {t.delete}
              </button>
            </div>
          )}
        </>
      ) : (
        <form onSubmit={handleSave}>
          <label className="field">
            <span className="field__label">{t.nameLabel}</span>
            <input
              className="field__input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              required
            />
          </label>
          <label className="field">
            <span className="field__label">{t.descriptionLabel}</span>
            <input
              className="field__input"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
            />
          </label>
          <label className="field">
            <span className="field__label">{t.statusLabel}</span>
            <select
              className="field__select"
              value={status}
              onChange={(e) => setStatus(e.target.value as ZoneStatus)}
            >
              <option value="NOT_STARTED">{t.status.NOT_STARTED}</option>
              <option value="IN_PROGRESS">{t.status.IN_PROGRESS}</option>
              <option value="ON_HOLD">{t.status.ON_HOLD}</option>
              <option value="DONE">{t.status.DONE}</option>
            </select>
          </label>
          {error ? <p className="error-text">{error}</p> : null}
          <div className="zone-panel__actions">
            <button type="submit" className="button button--primary" disabled={saving || !name.trim()}>
              {saving ? t.saving : t.save}
            </button>
            <button type="button" className="button" onClick={handleCancelEdit} disabled={saving}>
              {t.cancel}
            </button>
          </div>
        </form>
      )}
    </aside>
  )
}
