import { useId, useState, type FormEvent } from 'react'
import { Field, TEXT_LIMITS } from '../../components/form'
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
  const ids = { file: useId() }

  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [level, setLevel] = useState('')
  const [pageNumber, setPageNumber] = useState('1')
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
    if (name.trim().length > TEXT_LIMITS.documentName) return t.validation.nameTooLong
    return null
  }
  function descriptionIssue(): string | null {
    if (description.trim().length > TEXT_LIMITS.longText) return t.validation.descriptionTooLong
    return null
  }
  function levelIssue(): string | null {
    if (level.trim().length > TEXT_LIMITS.zoneLevel) return t.validation.levelTooLong
    return null
  }
  function pageIssue(): string | null {
    if (!(Number(pageNumber) >= 1)) return t.validation.pageNumberInvalid
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

    const effectiveName = name.trim() || file.name.replace(/\.[^.]+$/, '').slice(0, TEXT_LIMITS.documentName)
    setError(null)

    try {
      const ticket = await requestFloorPlanUpload(organizationId, siteId, {
        name: effectiveName,
        description: description.trim() || undefined,
        level: level.trim() || undefined,
        pageNumber: isPdf ? Number(pageNumber) : 1,
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

        <Field
          config={{
            name: 'floorPlanName',
            label: t.dialog.name,
            placeholder: file ? file.name.replace(/\.[^.]+$/, '').slice(0, TEXT_LIMITS.documentName) : t.dialog.namePlaceholder,
            autoComplete: 'off',
            maxLength: TEXT_LIMITS.documentName,
          }}
          value={name}
          error={nameIssue() ?? undefined}
          valid={Boolean(name.trim()) && !nameIssue()}
          disabled={busy}
          onChange={setName}
        />

        <Field
          config={{
            name: 'floorPlanDescription',
            label: t.dialog.description,
            type: 'textarea',
            placeholder: t.dialog.descriptionPlaceholder,
            rows: 2,
            maxLength: TEXT_LIMITS.longText,
          }}
          value={description}
          error={descriptionIssue() ?? undefined}
          valid={Boolean(description.trim()) && !descriptionIssue()}
          disabled={busy}
          onChange={setDescription}
        />

        <Field
          config={{
            name: 'floorPlanLevel',
            label: t.dialog.level,
            placeholder: t.dialog.levelPlaceholder,
            autoComplete: 'off',
            maxLength: TEXT_LIMITS.zoneLevel,
          }}
          value={level}
          error={levelIssue() ?? undefined}
          valid={Boolean(level.trim()) && !levelIssue()}
          disabled={busy}
          onChange={setLevel}
        />

        {isPdf ? (
          <Field
            config={{ name: 'floorPlanPage', label: t.dialog.pageNumber, type: 'number', maxDigits: 4, hint: t.dialog.pageNumberHint }}
            value={pageNumber}
            error={pageIssue() ?? undefined}
            valid={!pageIssue()}
            disabled={busy}
            onChange={setPageNumber}
          />
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
          <button type="submit" className="button button--primary" disabled={busy} aria-busy={busy}>
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
