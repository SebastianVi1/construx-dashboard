import { useState } from 'react'
import { useLocale } from '../../i18n'
import { createAssignment } from './zoneAssignmentsApi'
import type { DraggableResource, Shift } from './zoneAssignmentsApi'

interface AssignmentFormProps {
  organizationId: string
  siteId: string
  floorPlanId: string
  zoneId: string
  resource: DraggableResource
  onAssigned: () => void
  onCancel: () => void
}

export function AssignmentForm({
  organizationId,
  siteId,
  floorPlanId,
  zoneId,
  resource,
  onAssigned,
  onCancel,
}: AssignmentFormProps) {
  const { messages: m } = useLocale()
  const t = m.floorPlans.assignments

  const [activity, setActivity] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [shift, setShift] = useState<Shift>('FULL_DAY')
  const [submitting, setSubmitting] = useState(false)
  const [overlapWarning, setOverlapWarning] = useState(false)
  const [error, setError] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!activity.trim() || !startDate) return
    setSubmitting(true)
    setError(false)
    try {
      const result = await createAssignment(organizationId, siteId, floorPlanId, zoneId, {
        membershipId: resource.type === 'membership' ? resource.id : null,
        crewId: resource.type === 'crew' ? resource.id : null,
        equipmentId: resource.type === 'equipment' ? resource.id : null,
        activity: activity.trim(),
        startDate,
        endDate: endDate || null,
        shift,
      })
      if (result.hasOverlapWarning) {
        setOverlapWarning(true)
        // Still allow saving — just show the warning and close after user acknowledges
        setSubmitting(false)
        onAssigned()
        return
      }
      onAssigned()
    } catch {
      setError(true)
      setSubmitting(false)
    }
  }

  return (
    <div className="assignment-form-backdrop" role="dialog" aria-modal="true" aria-label={t.formTitle}>
      <div className="assignment-form">
        <h2 className="assignment-form__title">{t.formTitle}</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-label">{t.resourceLabel}</label>
            <p className="assignment-form__resource-name">{resource.name}</p>
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="af-activity">{t.activityLabel}</label>
            <input
              id="af-activity"
              type="text"
              className="form-input"
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              placeholder={t.activityPlaceholder}
              required
              maxLength={255}
              disabled={submitting}
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="af-start">{t.startDateLabel}</label>
            <input
              id="af-start"
              type="date"
              className="form-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="af-end">{t.endDateLabel}</label>
            <input
              id="af-end"
              type="date"
              className="form-input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || undefined}
              disabled={submitting}
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="af-shift">{t.shiftLabel}</label>
            <select
              id="af-shift"
              className="form-input"
              value={shift}
              onChange={(e) => setShift(e.target.value as Shift)}
              disabled={submitting}
            >
              <option value="MORNING">{t.shiftMorning}</option>
              <option value="AFTERNOON">{t.shiftAfternoon}</option>
              <option value="FULL_DAY">{t.shiftFullDay}</option>
            </select>
          </div>

          {overlapWarning ? (
            <p className="assignment-form__overlap-warning" role="alert">{t.overlapWarning}</p>
          ) : null}

          {error ? (
            <p className="error-text" role="alert">{t.error}</p>
          ) : null}

          <div className="assignment-form__actions">
            <button type="button" className="button button--muted" onClick={onCancel} disabled={submitting}>
              {t.cancel}
            </button>
            <button type="submit" className="button" disabled={submitting || !activity.trim() || !startDate}>
              {submitting ? t.submitting : t.submit}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
