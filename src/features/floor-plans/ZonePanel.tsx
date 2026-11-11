import { PanelSkeleton } from './FloorPlanSkeletons'
import { useState } from 'react'
import { useLocale } from '../../i18n'
import { Field, useForm } from '../../components/form'
import { useRemoteData } from '../../components/data/useRemoteData'
import { updateZone, deleteZone, ZONE_STATUS_COLORS } from './zonesApi'
import type { Zone } from './zonesApi'
import { makeZoneSchema, zoneFields, zoneInput } from './zoneForm'
import { listAssignments, closeAssignment, reassignToZone } from './zoneAssignmentsApi'
import type { ReassignDrag } from './zoneAssignmentsApi'
import { getZoneAudit } from './auditApi'
import { assignmentLabel, personOf } from './zoneOccupants'
import { Avatar } from '../profile/Avatar'
import '../profile/profile.css'
import '../../components/form/form.css'

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
  /** Called after an assignment is closed or moved from this panel. */
  onAssignmentsChanged?: () => void
  /** Name of the member behind a membership id, for the history. */
  nameFor?: (membershipId: string) => string
}

type Tab = 'assignments' | 'history'

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
  onAssignmentsChanged,
  nameFor,
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

  const editForm = useForm({
    initialValues: { name: zone.name, description: zone.description ?? '', status: zone.status as string },
    schema: makeZoneSchema(t.validation),
    onSubmit: async (values) => {
      setEditError(null)
      try {
        const updated = await updateZone(organizationId, siteId, floorPlanId, zone.id, {
          ...zoneInput(values),
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

  // Each tab reads when shown; the key drops answers of another zone or plan
  const zoneKey = `${organizationId}:${siteId}:${floorPlanId}:${zone.id}`
  const assignmentsRead = useRemoteData(activeTab === 'assignments' ? zoneKey : null, () =>
    listAssignments(organizationId, siteId, floorPlanId, zone.id),
  )
  const auditRead = useRemoteData(activeTab === 'history' ? zoneKey : null, () =>
    getZoneAudit(organizationId, siteId, floorPlanId, zone.id),
  )
  const assignments = assignmentsRead.data ?? []
  const auditEvents = auditRead.data ?? []
  const [actionError, setActionError] = useState(false)
  const [closingId, setClosingId] = useState<string | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [moveTargetId, setMoveTargetId] = useState<string>('')
  const [moveBusy, setMoveBusy] = useState(false)

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
      setActionError(false)
      await closeAssignment(organizationId, siteId, floorPlanId, zone.id, assignmentId)
      assignmentsRead.update((current) => current.filter((a) => a.id !== assignmentId))
      onAssignmentsChanged?.()
    } catch {
      setActionError(true)
    } finally {
      setClosingId(null)
    }
  }

  const handleMove = async (assignmentId: string) => {
    if (!moveTargetId || moveBusy) return
    setMovingId(assignmentId)
    setMoveBusy(true)
    try {
      setActionError(false)
      await reassignToZone(organizationId, siteId, floorPlanId, zone.id, assignmentId, moveTargetId)
      assignmentsRead.update((current) => current.filter((a) => a.id !== assignmentId))
      onAssignmentsChanged?.()
      setMovingId(null)
      setMoveTargetId('')
    } catch {
      setActionError(true)
      setMovingId(null)
    } finally {
      setMoveBusy(false)
    }
  }

  const otherZones = allZones.filter((z) => z.id !== zone.id)

  return (
    <aside className="zone-panel" style={{ ['--zone-color' as string]: ZONE_STATUS_COLORS[zone.status] }}>
      <div className="zone-panel__header">
        <div className="zone-panel__heading">
          <h2 className="zone-panel__title">{zone.name}</h2>
          <span className="zone-panel__status">
            <span className="zone-panel__dot" style={{ background: ZONE_STATUS_COLORS[zone.status] }} aria-hidden />
            <span className="visually-hidden">{t.statusLabel}: </span>
            {t.status[zone.status]}
          </span>
        </div>
        <button type="button" className="fp-close" onClick={onClose} aria-label={t.close}>
          ×
        </button>
      </div>

      <dl className="zone-panel__details">
        <dt>{t.areaLabel}</dt>
        <dd className="zone-panel__number">{zone.areaMSquared.toFixed(1)} m²</dd>
        <dt>{t.perimeterLabel}</dt>
        <dd className="zone-panel__number">{zone.perimeterMeters.toFixed(1)} m</dd>
      </dl>
      {zone.description ? <p className="zone-panel__description">{zone.description}</p> : null}

      {!editing ? (
        <>
          {deleteError ? <p className="error-text">{deleteError}</p> : null}
          {confirmDelete ? (
            <div className="zone-panel__confirm-delete">
              <p>{t.deleteConfirmBody}</p>
              <div className="zone-panel__actions">
                <button
                  type="button"
                  className="button button--small button--danger"
                  onClick={handleDelete}
                  disabled={deleting}
                  aria-busy={deleting}
                >
                  {deleting ? t.deleting : t.deleteConfirm}
                </button>
                <button
                  type="button"
                  className="button button--small"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                >
                  {t.cancel}
                </button>
              </div>
            </div>
          ) : (
            <div className="zone-panel__actions">
              <button type="button" className="button button--small" onClick={() => setEditing(true)}>
                {t.edit}
              </button>
              <button
                type="button"
                className="button button--small button--danger"
                onClick={() => setConfirmDelete(true)}
              >
                {t.delete}
              </button>
            </div>
          )}

          <div className="fp-segmented" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'assignments'}
              className="fp-segmented__option"
              onClick={() => setActiveTab('assignments')}
            >
              {th.assignmentsTab}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'history'}
              className="fp-segmented__option"
              onClick={() => setActiveTab('history')}
            >
              {th.historyTab}
            </button>
          </div>

          {activeTab === 'assignments' ? (
            <div className="zone-panel__tab-content" role="tabpanel">
              {actionError ? <p className="error-text" role="alert">{ta.error}</p> : null}
              {assignmentsRead.status === 'error' ? (
                <div role="alert">
                  <p className="error-text">{ta.loadError}</p>
                  <button type="button" className="button button--small" onClick={assignmentsRead.reload}>
                    {m.floorPlans.retry}
                  </button>
                </div>
              ) : !assignmentsRead.data ? (
                <PanelSkeleton kind="assignments" />
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
                          label: assignmentLabel(a) || (a.activity ?? ''),
                        }
                        e.dataTransfer.setData('application/json', JSON.stringify(drag))
                        e.dataTransfer.effectAllowed = 'move'
                        onReassignDragStart(drag)
                      }}
                      onDragEnd={onReassignDragEnd}
                    >
                      <div className="assignment-list__info">
                        {(() => {
                          const person = personOf(a)
                          return person ? <Avatar fullName={person.fullName} avatarUrl={person.avatarUrl} decorative /> : null
                        })()}
                        <span className="assignment-list__activity">{assignmentLabel(a) || a.activity}</span>
                      </div>
                      <div className="assignment-list__actions">
                        <button
                          type="button"
                          className="button button--small"
                          disabled={closingId === a.id}
                          onClick={() => handleClose(a.id)}
                        >
                          {ta.closeAssignment}
                        </button>
                        {otherZones.length > 0 ? (
                          <div className="assignment-list__move">
                            <select
                              className="form-field__control zone-panel__select"
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
                                className="button button--small button--primary"
                                disabled={moveBusy}
                                aria-busy={moveBusy}
                                onClick={() => void handleMove(a.id)}
                              >
                                {moveBusy ? t.saving : th.confirmMove}
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
              {auditRead.status === 'error' ? (
                <div role="alert">
                  <p className="error-text">{th.loadError}</p>
                  <button type="button" className="button button--small" onClick={auditRead.reload}>
                    {m.floorPlans.retry}
                  </button>
                </div>
              ) : !auditRead.data ? (
                <PanelSkeleton kind="audit" />
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
                          {nameFor?.(e.actorMembershipId) || `${e.actorMembershipId.slice(0, 8)}…`}
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
        <form className="zone-panel__form" noValidate onSubmit={editForm.onSubmit}>
          {zoneFields(t).map((field) => (
            <Field
              key={field.name}
              config={{ ...field, name: `zone-edit-${field.name}` }}
              value={editForm.values[field.name]}
              error={editForm.errors[field.name]}
              valid={editForm.valid[field.name]}
              disabled={editForm.isSubmitting}
              onChange={(value) => editForm.onChange(field.name, value)}
              onBlur={() => editForm.onBlur(field.name)}
            />
          ))}
          {editError ? <p className="error-text">{editError}</p> : null}
          <div className="zone-panel__actions">
            <button type="submit" className="button button--primary" disabled={editForm.isSubmitting} aria-busy={editForm.isSubmitting}>
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
