import { useState, useEffect } from 'react'
import { useLocale } from '../../i18n'
import type { Messages } from '../../i18n/messages'
import { updateZone, deleteZone } from './zonesApi'
import type { Zone, ZoneStatus } from './zonesApi'
import { listAssignments, closeAssignment, reassignToZone } from './zoneAssignmentsApi'
import type { AssignmentData } from './zoneAssignmentsApi'
import { getZoneAudit } from './auditApi'
import type { AuditEvent } from './auditApi'

interface ZonePanelProps {
  zone: Zone
  allZones: Zone[]
  organizationId: string
  siteId: string
  floorPlanId: string
  onUpdated: (zone: Zone) => void
  onDeleted: (zoneId: string) => void
  onClose: () => void
  onConflict: () => void
}

type Tab = 'assignments' | 'history'

function shiftLabel(ta: Messages['floorPlans']['assignments'], shift: string): string {
  if (shift === 'MORNING') return ta.shiftMorning
  if (shift === 'AFTERNOON') return ta.shiftAfternoon
  return ta.shiftFullDay
}

/** Side panel for viewing, editing, and deleting a selected zone, with Assignments and History tabs. */
export function ZonePanel({
  zone,
  allZones,
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
  const ta = m.floorPlans.assignments
  const th = m.floorPlans.audit

  const [activeTab, setActiveTab] = useState<Tab>('assignments')
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(zone.name)
  const [description, setDescription] = useState(zone.description ?? '')
  const [status, setStatus] = useState<ZoneStatus>(zone.status)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [assignments, setAssignments] = useState<AssignmentData[]>([])
  const [assignmentsLoading, setAssignmentsLoading] = useState(false)
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null)
  const [closingId, setClosingId] = useState<string | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [moveTargetId, setMoveTargetId] = useState<string>('')

  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditError, setAuditError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (activeTab === 'assignments') {
      listAssignments(organizationId, siteId, floorPlanId, zone.id)
        .then((data) => { if (!cancelled) { setAssignmentsLoading(false); setAssignments(data) } })
        .catch(() => { if (!cancelled) { setAssignmentsLoading(false); setAssignmentsError(ta.error) } })
    } else {
      getZoneAudit(organizationId, siteId, floorPlanId, zone.id)
        .then((data) => { if (!cancelled) { setAuditLoading(false); setAuditEvents(data) } })
        .catch(() => { if (!cancelled) { setAuditLoading(false); setAuditError(th.loadError) } })
    }
    return () => { cancelled = true }
  }, [activeTab, zone.id, organizationId, siteId, floorPlanId, ta.error, th.loadError])

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

  const handleClose = async (assignmentId: string) => {
    setClosingId(assignmentId)
    try {
      await closeAssignment(organizationId, siteId, floorPlanId, zone.id, assignmentId)
      setAssignments((prev) => prev.filter((a) => a.id !== assignmentId))
    } catch {
      setAssignmentsError(ta.error)
    } finally {
      setClosingId(null)
    }
  }

  const handleMove = async (assignmentId: string) => {
    if (!moveTargetId) return
    setMovingId(assignmentId)
    try {
      await reassignToZone(organizationId, siteId, floorPlanId, zone.id, assignmentId, moveTargetId)
      setAssignments((prev) => prev.filter((a) => a.id !== assignmentId))
      setMovingId(null)
      setMoveTargetId('')
    } catch {
      setAssignmentsError(ta.error)
      setMovingId(null)
    }
  }

  const otherZones = allZones.filter((z) => z.id !== zone.id)

  return (
    <aside className="zone-panel">
      <div className="zone-panel__header">
        <h2 className="zone-panel__title">{zone.name}</h2>
        <button type="button" className="zone-panel__close" onClick={onClose} aria-label={t.close}>
          ×
        </button>
      </div>

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

      {!editing ? (
        <>
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

          <div className="zone-panel__tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'assignments'}
              className={`zone-panel__tab${activeTab === 'assignments' ? ' zone-panel__tab--active' : ''}`}
              onClick={() => setActiveTab('assignments')}
            >
              {th.assignmentsTab}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'history'}
              className={`zone-panel__tab${activeTab === 'history' ? ' zone-panel__tab--active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              {th.historyTab}
            </button>
          </div>

          {activeTab === 'assignments' ? (
            <div className="zone-panel__tab-content" role="tabpanel">
              {assignmentsLoading ? (
                <p className="zone-panel__loading">{th.loading}</p>
              ) : assignmentsError ? (
                <p className="error-text">{assignmentsError}</p>
              ) : assignments.length === 0 ? (
                <p className="zone-panel__empty">{ta.noAssignments}</p>
              ) : (
                <ul className="assignment-list">
                  {assignments.map((a) => (
                    <li key={a.id} className="assignment-list__item">
                      <div className="assignment-list__info">
                        <span className="assignment-list__activity">{a.activity}</span>
                        <span className="assignment-list__dates">
                          {a.startDate}
                          {a.endDate ? ` → ${a.endDate}` : ''}
                        </span>
                        <span className="assignment-list__shift">{shiftLabel(ta, a.shift)}</span>
                      </div>
                      <div className="assignment-list__actions">
                        <button
                          type="button"
                          className="button button--sm"
                          disabled={closingId === a.id}
                          onClick={() => handleClose(a.id)}
                        >
                          {ta.closeAssignment}
                        </button>
                        {otherZones.length > 0 ? (
                          <div className="assignment-list__move">
                            <select
                              className="field__select field__select--sm"
                              value={movingId === a.id ? moveTargetId : ''}
                              onChange={(e) => {
                                setMoveTargetId(e.target.value)
                                setMovingId(a.id)
                              }}
                              aria-label={th.moveToZone}
                            >
                              <option value="">{th.moveToZone}</option>
                              {otherZones.map((z) => (
                                <option key={z.id} value={z.id}>
                                  {z.name}
                                </option>
                              ))}
                            </select>
                            {movingId === a.id && moveTargetId ? (
                              <button
                                type="button"
                                className="button button--sm button--primary"
                                onClick={() => handleMove(a.id)}
                              >
                                {th.confirmMove}
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="zone-panel__tab-content" role="tabpanel">
              {auditLoading ? (
                <p className="zone-panel__loading">{th.loading}</p>
              ) : auditError ? (
                <p className="error-text">{auditError}</p>
              ) : auditEvents.length === 0 ? (
                <p className="zone-panel__empty">{th.noEvents}</p>
              ) : (
                <ul className="audit-list">
                  {auditEvents.map((e) => (
                    <li key={e.id} className="audit-list__item">
                      <span className={`audit-badge audit-badge--${e.action.toLowerCase()}`}>
                        {th.action[e.action]}
                      </span>
                      <span className="audit-list__time">
                        {new Date(e.occurredAt).toLocaleString()}
                      </span>
                      {e.actorMembershipId ? (
                        <span className="audit-list__actor">
                          {e.actorMembershipId.slice(0, 8)}…
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
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
