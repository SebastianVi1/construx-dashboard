import { useState, useEffect } from 'react'
import { z } from 'zod'
import { useLocale } from '../../i18n'
import type { Messages } from '../../i18n/messages'
import { useForm } from '../../components/form'
import { updateZone, deleteZone } from './zonesApi'
import type { Zone, ZoneStatus } from './zonesApi'
import { listAssignments, closeAssignment, reassignToZone } from './zoneAssignmentsApi'
import type { AssignmentData, ReassignDrag } from './zoneAssignmentsApi'
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
  onReassignDragStart?: (drag: ReassignDrag) => void
  onReassignDragEnd?: () => void
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
  onReassignDragStart,
  onReassignDragEnd,
}: ZonePanelProps) {
  const { messages: m } = useLocale()
  const t = m.floorPlans.zones
  const ta = m.floorPlans.assignments
  const th = m.floorPlans.audit

  const [activeTab, setActiveTab] = useState<Tab>('assignments')
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const editSchema = z.object({
    name: z.string().min(1).max(120),
    description: z.string().max(500),
    status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'ON_HOLD', 'DONE']),
  })

  const editForm = useForm({
    initialValues: { name: zone.name, description: zone.description ?? '', status: zone.status as string },
    schema: editSchema,
    onSubmit: async (values) => {
      setEditError(null)
      try {
        const updated = await updateZone(organizationId, siteId, floorPlanId, zone.id, {
          name: values.name.trim(),
          description: values.description.trim() || null,
          status: values.status as ZoneStatus,
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
          setEditError(t.updateError)
          throw err
        }
      }
    },
  })

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

  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleDelete = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteZone(organizationId, siteId, floorPlanId, zone.id)
      onDeleted(zone.id)
    } catch {
      setDeleteError(t.deleteError)
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const handleCancelEdit = () => {
    setEditError(null)
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
          {deleteError ? <p className="error-text">{deleteError}</p> : null}
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
                    <li
                      key={a.id}
                      className="assignment-list__item"
                      draggable={Boolean(onReassignDragStart)}
                      onDragStart={(e) => {
                        if (!onReassignDragStart) return
                        const drag: ReassignDrag = {
                          assignmentId: a.id,
                          sourceZoneId: zone.id,
                          label: a.activity,
                        }
                        e.dataTransfer.setData('application/json', JSON.stringify(drag))
                        e.dataTransfer.effectAllowed = 'move'
                        onReassignDragStart(drag)
                      }}
                      onDragEnd={onReassignDragEnd}
                    >
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
        <form onSubmit={editForm.onSubmit}>
          <div className="form-field">
            <label className="form-field__label" htmlFor="zone-edit-name">{t.nameLabel}</label>
            <input
              id="zone-edit-name"
              className="form-field__control"
              type="text"
              value={editForm.values.name}
              onChange={(e) => editForm.onChange('name', e.target.value)}
              onBlur={() => editForm.onBlur('name')}
              maxLength={120}
              required
              disabled={editForm.isSubmitting}
              aria-invalid={Boolean(editForm.errors.name)}
            />
            {editForm.errors.name ? <p className="form-field__error">{editForm.errors.name}</p> : null}
          </div>
          <div className="form-field">
            <label className="form-field__label" htmlFor="zone-edit-description">{t.descriptionLabel}</label>
            <input
              id="zone-edit-description"
              className="form-field__control"
              type="text"
              value={editForm.values.description}
              onChange={(e) => editForm.onChange('description', e.target.value)}
              onBlur={() => editForm.onBlur('description')}
              maxLength={500}
              disabled={editForm.isSubmitting}
            />
          </div>
          <div className="form-field">
            <label className="form-field__label" htmlFor="zone-edit-status">{t.statusLabel}</label>
            <select
              id="zone-edit-status"
              className="form-field__control"
              value={editForm.values.status}
              onChange={(e) => editForm.onChange('status', e.target.value)}
              onBlur={() => editForm.onBlur('status')}
              disabled={editForm.isSubmitting}
            >
              <option value="NOT_STARTED">{t.status.NOT_STARTED}</option>
              <option value="IN_PROGRESS">{t.status.IN_PROGRESS}</option>
              <option value="ON_HOLD">{t.status.ON_HOLD}</option>
              <option value="DONE">{t.status.DONE}</option>
            </select>
          </div>
          {editError ? <p className="error-text">{editError}</p> : null}
          <div className="zone-panel__actions">
            <button type="submit" className="button button--primary" disabled={editForm.isSubmitting || !editForm.values.name.trim()}>
              {editForm.isSubmitting ? t.saving : t.save}
            </button>
            <button type="button" className="button" onClick={handleCancelEdit} disabled={editForm.isSubmitting}>
              {t.cancel}
            </button>
          </div>
        </form>
      )}
    </aside>
  )
}
