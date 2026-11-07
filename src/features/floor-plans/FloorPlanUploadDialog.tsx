import { useId, useState, type FormEvent } from 'react'
import { Modal } from '../../components/modal'
import { formatMessage, useLocale } from '../../i18n'
import {
  floorPlanErrorKind,
  requestFloorPlanUpload,
  completeFloorPlanUpload,
  sendFloorPlanToStorage,
  type FloorPlan,
} from './floorPlansApi'
import './floor-plans.css'

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 50 * 1024 * 1024

type Stage = { kind: 'idle' } | { kind: 'uploading'; progress: number } | { kind: 'confirming' }

type FloorPlanUploadDialogProps = {
  organizationId: string
  siteId: string
  onUploaded: (floorPlan: FloorPlan) => void
  onClose: () => void
}

export function FloorPlanUploadDialog({ organizationId, siteId, onUploaded, onClose }: FloorPlanUploadDialogProps) {
  const { messages: m } = useLocale()
  const t = m.floorPlans
  const ids = { file: useId(), name: useId(), description: useId(), level: useId(), page: useId() }

  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [level, setLevel] = useState('')
  const [pageNumber, setPageNumber] = useState(1)
  const [fileError, setFileError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>({ kind: 'idle' })

  const busy = stage.kind !== 'idle'

  function pick(picked: File | undefined) {
    setFileError(null)
    setError(null)
    if (!picked) return
    if (!ACCEPTED_TYPES.includes(picked.type)) {
      setFile(null)
      setFileError(t.validation.fileType)
      return
    }
    if (picked.size > MAX_SIZE_BYTES) {
      setFile(null)
      setFileError(t.validation.tooLarge)
      return
    }
    setFile(picked)
  }

  function nameIssue(): string | null {
    if (name.trim().length > 120) return t.validation.nameTooLong
    return null
  }
  function descriptionIssue(): string | null {
    if (description.trim().length > 500) return t.validation.descriptionTooLong
    return null
  }
  function levelIssue(): string | null {
    if (level.trim().length > 60) return t.validation.levelTooLong
    return null
  }
  function pageIssue(): string | null {
    if (pageNumber < 1 || !Number.isInteger(pageNumber)) return t.validation.pageNumberInvalid
    return null
  }

  const isPdf = file?.type === 'application/pdf'

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (!file) {
      setFileError(t.validation.required)
      return
    }
    if (nameIssue() || descriptionIssue() || levelIssue() || pageIssue()) return

    const effectiveName = name.trim() || file.name.replace(/\.[^.]+$/, '').slice(0, 120)
    setError(null)

    try {
      const ticket = await requestFloorPlanUpload(organizationId, siteId, {
        name: effectiveName,
        description: description.trim() || undefined,
        level: level.trim() || undefined,
        pageNumber: isPdf ? pageNumber : 1,
        contentType: file.type,
        sizeBytes: file.size,
      })
      setStage({ kind: 'uploading', progress: 0 })
      await sendFloorPlanToStorage(ticket, file, (progress) => setStage({ kind: 'uploading', progress }))
      setStage({ kind: 'confirming' })
      onUploaded(await completeFloorPlanUpload(organizationId, siteId, ticket.floorPlanId))
    } catch (failure) {
      setError(t.error[floorPlanErrorKind(failure)])
      setStage({ kind: 'idle' })
    }
  }

  return (
    <Modal title={t.dialog.title} description={t.dialog.body} onClose={busy ? () => {} : onClose}>
      <form className="form floor-plan-upload" onSubmit={(event) => void submit(event)} noValidate>
        <div className="form-field">
          <span className="form-field__label">{t.dialog.file}</span>
          <div className="floor-plan-upload__picker">
            <label className="button" htmlFor={ids.file}>
              {file ? t.dialog.change : t.dialog.choose}
            </label>
            <input
              id={ids.file}
              className="floor-plan-upload__input"
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              disabled={busy}
              aria-invalid={fileError ? true : undefined}
              aria-describedby={fileError ? `${ids.file}-error` : undefined}
              onChange={(event) => pick(event.target.files?.[0])}
            />
            <span className="floor-plan-upload__file data-mono">{file ? file.name : t.dialog.noFile}</span>
          </div>
          {fileError ? (
            <p id={`${ids.file}-error`} className="form-field__error" role="alert">
              {fileError}
            </p>
          ) : null}
        </div>

        <div className="form-field">
          <label className="form-field__label" htmlFor={ids.name}>
            {t.dialog.name}
          </label>
          <input
            id={ids.name}
            className="form-field__control"
            value={name}
            placeholder={file ? file.name.replace(/\.[^.]+$/, '').slice(0, 120) : t.dialog.namePlaceholder}
            disabled={busy}
            aria-invalid={nameIssue() ? true : undefined}
            onChange={(event) => setName(event.target.value)}
          />
          {nameIssue() ? <p className="form-field__error">{nameIssue()}</p> : null}
        </div>

        <div className="form-field">
          <label className="form-field__label" htmlFor={ids.description}>
            {t.dialog.description}
          </label>
          <textarea
            id={ids.description}
            className="form-field__control"
            value={description}
            placeholder={t.dialog.descriptionPlaceholder}
            rows={2}
            disabled={busy}
            aria-invalid={descriptionIssue() ? true : undefined}
            onChange={(event) => setDescription(event.target.value)}
          />
          {descriptionIssue() ? <p className="form-field__error">{descriptionIssue()}</p> : null}
        </div>

        <div className="form-field">
          <label className="form-field__label" htmlFor={ids.level}>
            {t.dialog.level}
          </label>
          <input
            id={ids.level}
            className="form-field__control"
            value={level}
            placeholder={t.dialog.levelPlaceholder}
            disabled={busy}
            aria-invalid={levelIssue() ? true : undefined}
            onChange={(event) => setLevel(event.target.value)}
          />
          {levelIssue() ? <p className="form-field__error">{levelIssue()}</p> : null}
        </div>

        {isPdf ? (
          <div className="form-field">
            <label className="form-field__label" htmlFor={ids.page}>
              {t.dialog.pageNumber}
            </label>
            <input
              id={ids.page}
              className="form-field__control"
              type="number"
              min={1}
              value={pageNumber}
              disabled={busy}
              aria-describedby={`${ids.page}-hint`}
              aria-invalid={pageIssue() ? true : undefined}
              onChange={(event) => setPageNumber(Math.max(1, parseInt(event.target.value, 10) || 1))}
            />
            <p id={`${ids.page}-hint`} className="form-field__hint">{t.dialog.pageNumberHint}</p>
            {pageIssue() ? <p className="form-field__error">{pageIssue()}</p> : null}
          </div>
        ) : null}

        {stage.kind === 'uploading' ? (
          <progress className="floor-plan-upload__progress" max={1} value={stage.progress} aria-label={t.dialog.title} />
        ) : null}

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="button-row button-row--end modal-actions">
          <button type="button" className="button" onClick={onClose} disabled={busy}>
            {t.dialog.cancel}
          </button>
          <button type="submit" className="button button--primary" disabled={busy}>
            {stage.kind === 'uploading'
              ? formatMessage(t.dialog.uploading, { percent: Math.round(stage.progress * 100) })
              : stage.kind === 'confirming'
                ? t.dialog.confirming
                : t.dialog.submit}
          </button>
        </div>
      </form>
    </Modal>
  )
}
