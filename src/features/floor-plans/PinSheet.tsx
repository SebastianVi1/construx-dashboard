import { useRef, useState } from 'react'
import { formatMessage, useLocale } from '../../i18n'
import { ApiError } from '../../lib/http'
import { useRemoteData } from '../../components/data/useRemoteData'
import {
  addPinPhotos,
  createPin,
  deletePin,
  deletePinPhoto,
  getPin,
  getPinAudit,
  setPinStatus,
  updatePin,
} from './pinsApi'
import type { PhotoPhase, PinDetail, PinKind, PinStatus } from './pinsApi'
import { getFloorPlanRoster } from './floorPlanRosterApi'
import { PIN_DESCRIPTION_MAX, PIN_TITLE_MAX, pinErrors, pinInput, pinVariant, type PinValues } from './pinForm'
import { MAX_PIN_PHOTOS, uploadPinPhoto } from './pinPhoto'
import { usePhotoUploads } from './usePhotoUploads'
import { PinIcon } from './floorPlanIcons'
import { Avatar } from '../profile/Avatar'
import '../profile/profile.css'
import '../../components/form/form.css'

type Target = { organizationId: string; siteId: string; floorPlanId: string }

export type PinSheetMode = { kind: 'create'; x: number; y: number } | { kind: 'view'; pinId: string }

interface PinSheetProps extends Target {
  mode: PinSheetMode
  /** Managers assign issues, so only they need the site's staff. */
  canManagePlan: boolean
  /** A pin was created or changed; the list and the plan take the new version. */
  onSaved: (pin: PinDetail) => void
  onDeleted: (pinId: string) => void
  onClose: () => void
  /** Name of the member behind a membership id, for the history. */
  nameFor?: (membershipId: string) => string
}

/** Create form or detail of a pin: a side panel on desktop, a bottom sheet on a phone. */
export function PinSheet({ mode, ...rest }: PinSheetProps) {
  return mode.kind === 'create' ? (
    <PinCreateForm key={`${mode.x}:${mode.y}`} x={mode.x} y={mode.y} {...rest} />
  ) : (
    <PinDetailView key={mode.pinId} pinId={mode.pinId} {...rest} />
  )
}

/** Site staff a manager can give an issue to; nobody else is asked for it. */
function useAssignees({ organizationId, siteId }: Target, enabled: boolean) {
  const roster = useRemoteData(enabled ? `${organizationId}:${siteId}` : null, () =>
    getFloorPlanRoster(organizationId, siteId),
  )
  return roster.data?.people ?? []
}

function PhotoInput({ label, disabled, onPick }: { label: string; disabled?: boolean; onPick: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept="image/*"
        // Phones open the back camera; a desktop browser shows its file dialog
        capture="environment"
        multiple
        tabIndex={-1}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          // Let the same file be picked again after a removal
          e.target.value = ''
          if (files.length > 0) onPick(files)
        }}
      />
      <button type="button" className="button button--small" disabled={disabled} onClick={() => inputRef.current?.click()}>
        {label}
      </button>
    </>
  )
}

type CreateProps = Omit<PinSheetProps, 'mode'> & { x: number; y: number }

function PinCreateForm({ x, y, canManagePlan, onSaved, onClose, ...target }: CreateProps) {
  const { messages: m } = useLocale()
  const t = m.floorPlans.pins
  const { organizationId, siteId, floorPlanId } = target

  const [kind, setKind] = useState<PinKind>('ISSUE')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assigneeMembershipId, setAssigneeMembershipId] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const uploads = usePhotoUploads(organizationId, siteId, floorPlanId)
  const assignees = useAssignees(target, canManagePlan)

  const values: PinValues = { kind, title, description, assigneeMembershipId, photoCount: uploads.items.length }
  const errors = pinErrors(values)
  const shown = submitted ? errors : {}

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (Object.keys(errors).length > 0 || !uploads.allDone || saving) return
    setSaving(true)
    setSaveError(false)
    try {
      onSaved(
        await createPin(organizationId, siteId, floorPlanId, { kind, x, y, ...pinInput(values), photoKeys: uploads.keys }),
      )
    } catch {
      // Everything typed and uploaded stays in the form for another try
      setSaveError(true)
      setSaving(false)
    }
  }

  return (
    <aside className="zone-panel pin-sheet" aria-label={t.newTitle}>
      <div className="zone-panel__header">
        <h2 className="zone-panel__title">{t.newTitle}</h2>
        <button type="button" className="fp-close" onClick={onClose} aria-label={t.close}>
          ×
        </button>
      </div>

      <form className="zone-panel__form" noValidate onSubmit={handleSubmit}>
        <div className="fp-segmented" role="group" aria-label={t.kindLabel}>
          {(['ISSUE', 'PHOTO'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className="fp-segmented__option"
              aria-pressed={kind === option}
              aria-selected={kind === option}
              onClick={() => setKind(option)}
            >
              {t.kind[option]}
            </button>
          ))}
        </div>

        <div className="form-field">
          <label className="form-field__label" htmlFor="pin-title">{t.titleLabel}</label>
          <input
            id="pin-title"
            className="form-field__control"
            value={title}
            maxLength={PIN_TITLE_MAX}
            placeholder={kind === 'ISSUE' ? t.titlePlaceholderIssue : t.titlePlaceholderPhoto}
            autoComplete="off"
            aria-invalid={Boolean(shown.title)}
            aria-describedby={shown.title ? 'pin-title-error' : undefined}
            disabled={saving}
            onChange={(e) => setTitle(e.target.value)}
          />
          {shown.title ? <p id="pin-title-error" className="form-field__error">{t.validation[shown.title]}</p> : null}
        </div>

        <div className="form-field">
          <label className="form-field__label" htmlFor="pin-description">{t.descriptionLabel}</label>
          <textarea
            id="pin-description"
            className="form-field__control"
            rows={2}
            value={description}
            maxLength={PIN_DESCRIPTION_MAX}
            placeholder={t.descriptionPlaceholder}
            disabled={saving}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {kind === 'ISSUE' && canManagePlan ? (
          <div className="form-field">
            <label className="form-field__label" htmlFor="pin-assignee">{t.assigneeLabel}</label>
            <select
              id="pin-assignee"
              className="form-field__control"
              value={assigneeMembershipId}
              disabled={saving}
              onChange={(e) => setAssigneeMembershipId(e.target.value)}
            >
              <option value="">{t.assigneeNone}</option>
              {assignees.map((person) => (
                <option key={person.membershipId} value={person.membershipId}>
                  {person.fullName ?? t.unknownPerson}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="form-field">
          <span className="form-field__label">{t.photosLabel}</span>
          {uploads.items.length > 0 ? (
            <ul className="pin-photos">
              {uploads.items.map((item) => (
                <li key={item.id} className={`pin-photo pin-photo--${item.state}`}>
                  <img src={item.previewUrl} alt="" />
                  {item.state !== 'done' ? (
                    <span className="pin-photo__state" role="status">
                      {item.state === 'uploading' ? t.photoUploading : item.state === 'tooLarge' ? t.photoTooLarge : t.photoFailed}
                    </span>
                  ) : null}
                  {item.state === 'failed' ? (
                    <button type="button" className="pin-photo__retry" onClick={() => uploads.retry(item.id)}>
                      {t.photoRetry}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="pin-photo__remove"
                    aria-label={t.photoRemove}
                    disabled={saving}
                    onClick={() => uploads.remove(item.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <PhotoInput
            label={uploads.items.length === 0 ? t.takePhoto : t.addPhoto}
            disabled={saving || uploads.items.length >= MAX_PIN_PHOTOS}
            onPick={(files) => uploads.add(files.slice(0, MAX_PIN_PHOTOS - uploads.items.length))}
          />
          {shown.photos ? <p className="form-field__error">{t.validation[shown.photos]}</p> : null}
          {submitted && !shown.photos && !uploads.allDone ? <p className="form-field__error">{t.photosWaiting}</p> : null}
        </div>

        {saveError ? <p className="error-text" role="alert">{t.saveError}</p> : null}
        <div className="zone-panel__actions">
          <button type="submit" className="button button--primary" disabled={saving} aria-busy={saving}>
            {saving ? t.saving : t.save}
          </button>
          <button type="button" className="button" onClick={onClose} disabled={saving}>
            {t.cancel}
          </button>
        </div>
      </form>
    </aside>
  )
}

/** An issue's life in order; closing straight from open skips the middle step's date. */
const PIN_STEPS: PinStatus[] = ['OPEN', 'RESOLVED', 'CLOSED']

type DetailProps = Omit<PinSheetProps, 'mode'> & { pinId: string }

function PinDetailView({ pinId, onSaved, onDeleted, onClose, nameFor, ...target }: DetailProps) {
  const { messages: m, locale } = useLocale()
  const t = m.floorPlans.pins
  const { organizationId, siteId, floorPlanId } = target
  const key = `${organizationId}:${siteId}:${floorPlanId}:${pinId}`
  const when = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
  const day = (iso: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(iso))

  const read = useRemoteData(key, () => getPin(organizationId, siteId, floorPlanId, pinId))
  const pin = read.data
  const [tab, setTab] = useState<'details' | 'history'>('details')
  const audit = useRemoteData(tab === 'history' ? `${key}:${pin?.version ?? ''}:${pin?.photos.length ?? ''}` : null, () =>
    getPinAudit(organizationId, siteId, floorPlanId, pinId),
  )
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<'error' | 'conflict' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editing, setEditing] = useState(false)

  /** One change at a time; a stale pin (409) is read again instead of overwritten. */
  async function run(change: () => Promise<PinDetail | void>) {
    if (busy) return
    setBusy(true)
    setNotice(null)
    try {
      const changed = await change()
      if (changed) {
        read.update(() => changed)
        onSaved(changed)
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setNotice('conflict')
        read.reload()
      } else {
        setNotice('error')
      }
    } finally {
      setBusy(false)
    }
  }

  async function upload(files: File[], room: number): Promise<string[]> {
    const keys: string[] = []
    for (const file of files.slice(0, room)) keys.push(await uploadPinPhoto(organizationId, siteId, floorPlanId, file))
    return keys
  }

  if (!pin) {
    return (
      <aside className="zone-panel pin-sheet">
        <div className="zone-panel__header">
          <p className="zone-panel__loading">{read.status === 'error' ? t.detailError : t.detailLoading}</p>
          <button type="button" className="fp-close" onClick={onClose} aria-label={t.close}>
            ×
          </button>
        </div>
        {read.status === 'error' ? (
          <button type="button" className="button button--small" onClick={read.reload}>
            {m.floorPlans.retry}
          </button>
        ) : null}
      </aside>
    )
  }

  const room = MAX_PIN_PHOTOS - pin.photos.length
  const setStatus = (status: PinStatus, photoKeys: string[] = []) =>
    run(() => setPinStatus(organizationId, siteId, floorPlanId, pin.id, status, photoKeys))
  const addPhotos = (files: File[], phase: PhotoPhase) =>
    run(async () => addPinPhotos(organizationId, siteId, floorPlanId, pin.id, await upload(files, room), phase))
  const personName = (id: string) =>
    (id === pin.createdBy.membershipId ? pin.createdBy.fullName : id === pin.assignee?.membershipId ? pin.assignee.fullName : null) ??
    (nameFor?.(id) || t.unknownPerson)

  const photoGroup = (phase: PhotoPhase, heading: string) => {
    const photos = pin.photos.filter((photo) => photo.phase === phase)
    if (photos.length === 0) return null
    return (
      <section className="pin-sheet__photos">
        <h3 className="pin-sheet__subheading">{heading}</h3>
        <ul className="pin-photos">
          {photos.map((photo) => (
            <li key={photo.id} className="pin-photo">
              <a href={photo.url} target="_blank" rel="noreferrer" aria-label={t.photoOpen}>
                <img src={photo.url} alt="" loading="lazy" />
              </a>
              {pin.can.edit ? (
                <button
                  type="button"
                  className="pin-photo__remove"
                  aria-label={t.photoRemove}
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await deletePinPhoto(organizationId, siteId, floorPlanId, pin.id, photo.id)
                      return getPin(organizationId, siteId, floorPlanId, pin.id)
                    })
                  }
                >
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    )
  }

  return (
    <aside className={`zone-panel pin-sheet pin-sheet--${pinVariant(pin)}`}>
      <div className="zone-panel__header">
        <div className="zone-panel__heading">
          <h2 className="zone-panel__title">{pin.title ?? t.untitledPhoto}</h2>
          {pin.kind === 'PHOTO' ? <span className="pin-status pin-status--photo">{t.kind.PHOTO}</span> : null}
        </div>
        <button type="button" className="fp-close" onClick={onClose} aria-label={t.close}>
          ×
        </button>
      </div>

      {notice ? (
        <p className="error-text" role="alert">
          {notice === 'conflict' ? t.conflict : t.actionError}
        </p>
      ) : null}

      {editing ? (
        <PinEditForm
          pin={pin}
          assignees={<AssigneeOptions target={target} enabled={pin.can.assign} current={pin} />}
          busy={busy}
          onCancel={() => setEditing(false)}
          onSubmit={(values) =>
            run(async () => {
              const updated = await updatePin(organizationId, siteId, floorPlanId, pin.id, {
                ...pinInput({ ...values, kind: pin.kind, photoCount: pin.photos.length }),
                x: pin.x,
                y: pin.y,
                version: pin.version,
              })
              setEditing(false)
              return updated
            })
          }
        />
      ) : (
        <>
          {pin.kind === 'ISSUE' && pin.status ? (
            <ol className="pin-track" aria-label={t.statusLabel}>
              {PIN_STEPS.map((step, index) => {
                const current = PIN_STEPS.indexOf(pin.status ?? 'OPEN')
                const date = step === 'RESOLVED' ? pin.resolvedAt : step === 'CLOSED' ? pin.closedAt : pin.createdAt
                return (
                  <li
                    key={step}
                    className={`pin-track__step pin-track__step--${step.toLowerCase()}`}
                    data-reached={index <= current || undefined}
                    aria-current={index === current ? 'step' : undefined}
                  >
                    <span className="pin-track__label">{t.status[step]}</span>
                    {index <= current && date ? <span className="pin-track__date">{day(date)}</span> : null}
                  </li>
                )
              })}
            </ol>
          ) : null}

          <ul className="pin-people">
            <li className="pin-person">
              <Avatar fullName={pin.createdBy.fullName} decorative />
              <span className="pin-person__text">
                <span className="visually-hidden">{t.reportedBy}: </span>
                <span className="pin-person__name">{pin.createdBy.fullName ?? t.unknownPerson}</span>
                <span className="pin-person__note">
                  {formatMessage(pin.kind === 'ISSUE' ? t.reportedAt : t.addedAt, { date: when(pin.createdAt) })}
                </span>
              </span>
            </li>
            {pin.kind === 'ISSUE' ? (
              <li className="pin-person">
                {pin.assignee ? (
                  <Avatar fullName={pin.assignee.fullName} decorative />
                ) : (
                  <span className="pin-person__nobody" aria-hidden />
                )}
                <span className="pin-person__text">
                  <span className="pin-person__name">
                    {pin.assignee ? (pin.assignee.fullName ?? t.unknownPerson) : t.unassigned}
                  </span>
                  {pin.assignee ? <span className="pin-person__note">{t.assignedRole}</span> : null}
                </span>
                {!pin.assignee && pin.can.assign ? (
                  <button type="button" className="button button--small" disabled={busy} onClick={() => setEditing(true)}>
                    {t.assign}
                  </button>
                ) : null}
              </li>
            ) : null}
          </ul>

          <p className="pin-place">
            <PinIcon />
            <span className="visually-hidden">{t.zone}: </span>
            {pin.zoneName ?? t.noZone}
          </p>
          {pin.description ? <p className="zone-panel__description">{pin.description}</p> : null}

          {pin.can.resolve || pin.can.close || pin.can.reopen ? (
            <div className="zone-panel__actions pin-sheet__primary">
              {pin.can.resolve ? (
                <>
                  <button type="button" className="button button--small button--primary" disabled={busy} onClick={() => void setStatus('RESOLVED')}>
                    {t.resolve}
                  </button>
                  <PhotoInput
                    label={t.resolveWithPhoto}
                    disabled={busy || room <= 0}
                    onPick={(files) => void run(async () => setPinStatus(organizationId, siteId, floorPlanId, pin.id, 'RESOLVED', await upload(files, room)))}
                  />
                </>
              ) : null}
              {pin.can.close ? (
                <button
                  type="button"
                  className={`button button--small${pin.can.resolve ? '' : ' button--primary'}`}
                  disabled={busy}
                  onClick={() => void setStatus('CLOSED')}
                >
                  {t.closeIssue}
                </button>
              ) : null}
              {pin.can.reopen ? (
                <button type="button" className="button button--small" disabled={busy} onClick={() => void setStatus('OPEN')}>
                  {t.reopen}
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="fp-segmented" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'details'} className="fp-segmented__option" onClick={() => setTab('details')}>
              {t.detailsTab}
            </button>
            <button type="button" role="tab" aria-selected={tab === 'history'} className="fp-segmented__option" onClick={() => setTab('history')}>
              {t.historyTab}
            </button>
          </div>

          {tab === 'details' ? (
            <div className="zone-panel__tab-content" role="tabpanel">
              {pin.photos.length === 0 ? <p className="zone-panel__empty">{t.noPhotos}</p> : null}
              {photoGroup('REPORT', t.reportPhotos)}
              {photoGroup('RESOLUTION', t.resolutionPhotos)}
              {busy ? <p className="zone-panel__loading" role="status">{t.saving}</p> : null}

              {confirmDelete ? (
                <div className="zone-panel__confirm-delete">
                  <p>{t.deleteConfirmBody}</p>
                  <div className="zone-panel__actions">
                    <button
                      type="button"
                      className="button button--small button--danger"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await deletePin(organizationId, siteId, floorPlanId, pin.id)
                          onDeleted(pin.id)
                        })
                      }
                    >
                      {busy ? t.deleting : t.deleteConfirm}
                    </button>
                    <button type="button" className="button button--small" disabled={busy} onClick={() => setConfirmDelete(false)}>
                      {t.cancel}
                    </button>
                  </div>
                </div>
              ) : pin.can.edit || pin.can.assign || pin.can.delete ? (
                <div className="zone-panel__actions">
                  {pin.can.edit ? (
                    <PhotoInput label={t.addPhoto} disabled={busy || room <= 0} onPick={(files) => void addPhotos(files, 'REPORT')} />
                  ) : null}
                  {pin.can.edit || pin.can.assign ? (
                    <button type="button" className="button button--small" disabled={busy} onClick={() => setEditing(true)}>
                      {t.edit}
                    </button>
                  ) : null}
                  {pin.can.delete ? (
                    <button type="button" className="button button--small button--danger" disabled={busy} onClick={() => setConfirmDelete(true)}>
                      {t.delete}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="zone-panel__tab-content" role="tabpanel">
              {audit.status === 'error' ? (
                <div role="alert">
                  <p className="error-text">{m.floorPlans.audit.loadError}</p>
                  <button type="button" className="button button--small" onClick={audit.reload}>
                    {m.floorPlans.retry}
                  </button>
                </div>
              ) : !audit.data ? (
                <p className="zone-panel__loading">{m.floorPlans.audit.loading}</p>
              ) : (
                <ul className="audit-list">
                  {audit.data.map((event) => (
                    <li key={event.id} className="audit-list__item">
                      <span className="audit-badge audit-badge--update">
                        {t.historyAction[event.action as keyof typeof t.historyAction] ?? event.action}
                      </span>
                      <span className="audit-list__time">{new Date(event.occurredAt).toLocaleString()}</span>
                      {event.actorMembershipId ? <span className="audit-list__actor">{personName(event.actorMembershipId)}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </aside>
  )
}

/** The options of the assignee select; the current assignee stays listed even before the staff loads. */
function AssigneeOptions({ target, enabled, current }: { target: Target; enabled: boolean; current: PinDetail }) {
  const { messages: m } = useLocale()
  const t = m.floorPlans.pins
  const people = useAssignees(target, enabled)
  const assignee = current.assignee
  const listed = assignee && !people.some((person) => person.membershipId === assignee.membershipId)
  return (
    <>
      <option value="">{t.assigneeNone}</option>
      {listed ? <option value={assignee.membershipId}>{assignee.fullName ?? t.unknownPerson}</option> : null}
      {people.map((person) => (
        <option key={person.membershipId} value={person.membershipId}>
          {person.fullName ?? t.unknownPerson}
        </option>
      ))}
    </>
  )
}

type EditValues = Pick<PinValues, 'title' | 'description' | 'assigneeMembershipId'>

function PinEditForm({
  pin,
  assignees,
  busy,
  onSubmit,
  onCancel,
}: {
  pin: PinDetail
  assignees: React.ReactNode
  busy: boolean
  onSubmit: (values: EditValues) => void
  onCancel: () => void
}) {
  const { messages: m } = useLocale()
  const t = m.floorPlans.pins
  const [title, setTitle] = useState(pin.title ?? '')
  const [description, setDescription] = useState(pin.description ?? '')
  const [assigneeMembershipId, setAssigneeMembershipId] = useState(pin.assignee?.membershipId ?? '')
  const errors = pinErrors({ kind: pin.kind, title, description, assigneeMembershipId, photoCount: pin.photos.length })

  return (
    <form
      className="zone-panel__form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (!errors.title && !errors.description) onSubmit({ title, description, assigneeMembershipId })
      }}
    >
      <div className="form-field">
        <label className="form-field__label" htmlFor="pin-edit-title">{t.titleLabel}</label>
        <input
          id="pin-edit-title"
          className="form-field__control"
          value={title}
          maxLength={PIN_TITLE_MAX}
          autoComplete="off"
          aria-invalid={Boolean(errors.title)}
          // Reporters keep their text; only a manager may be here just to assign
          disabled={busy || !pin.can.edit}
          onChange={(e) => setTitle(e.target.value)}
        />
        {errors.title ? <p className="form-field__error">{t.validation[errors.title]}</p> : null}
      </div>
      <div className="form-field">
        <label className="form-field__label" htmlFor="pin-edit-description">{t.descriptionLabel}</label>
        <textarea
          id="pin-edit-description"
          className="form-field__control"
          rows={3}
          value={description}
          maxLength={PIN_DESCRIPTION_MAX}
          disabled={busy || !pin.can.edit}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      {pin.can.assign ? (
        <div className="form-field">
          <label className="form-field__label" htmlFor="pin-edit-assignee">{t.assigneeLabel}</label>
          <select
            id="pin-edit-assignee"
            className="form-field__control"
            value={assigneeMembershipId}
            disabled={busy}
            onChange={(e) => setAssigneeMembershipId(e.target.value)}
          >
            {assignees}
          </select>
        </div>
      ) : null}
      <div className="zone-panel__actions">
        <button type="submit" className="button button--primary" disabled={busy} aria-busy={busy}>
          {busy ? t.saving : m.floorPlans.zones.save}
        </button>
        <button type="button" className="button" onClick={onCancel} disabled={busy}>
          {t.cancel}
        </button>
      </div>
    </form>
  )
}
