import { useEffect, useId, useState, type FormEvent } from 'react'
import { Modal } from '../../components/modal'
import { formatMessage, useLocale } from '../../i18n'
import {
  MAX_FINAL_BYTES,
  compressImage,
  planDescriptionIssue,
  planFileIssue,
  planNameIssue,
} from './planUpload'
import { completePlanUpload, planErrorKind, requestPlanUpload, sendToStorage, type Plan } from './plansApi'
import { megabytes } from './planDisplay'

type PlanUploadDialogProps = {
  organizationId: string
  siteId: string
  onUploaded: (plan: Plan) => void
  onClose: () => void
}

type Stage = { kind: 'idle' } | { kind: 'compressing' } | { kind: 'uploading'; progress: number } | { kind: 'confirming' }

/** Pick an image, compress it in the browser, send it straight to storage, then confirm it with the API. */
export function PlanUploadDialog({ organizationId, siteId, onUploaded, onClose }: PlanUploadDialogProps) {
  const { messages: m } = useLocale()
  const t = m.plans
  const ids = { file: useId(), name: useId(), description: useId() }
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [compressedNote, setCompressedNote] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>({ kind: 'idle' })

  // The object URL is made when a file is picked; release it when it changes or the dialog closes.
  useEffect(() => {
    if (!preview) return
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  const nameIssue = planNameIssue(name)
  const descriptionIssue = planDescriptionIssue(description)
  const busy = stage.kind !== 'idle'

  function pick(picked: File | undefined) {
    setError(null)
    setCompressedNote(null)
    if (!picked) return
    const issue = planFileIssue(picked)
    if (issue) {
      setFile(null)
      setPreview(null)
      setFileError(t.validation[issue])
      return
    }
    setFileError(null)
    setFile(picked)
    setPreview(URL.createObjectURL(picked))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (!file) {
      setFileError(t.validation.required)
      return
    }
    if (nameIssue || descriptionIssue) return
    setError(null)
    try {
      setStage({ kind: 'compressing' })
      const upload = await compressImage(file)
      if (upload !== file) {
        setCompressedNote(formatMessage(t.dialog.compressed, { from: megabytes(file.size), to: megabytes(upload.size) }))
      }
      if (upload.size > MAX_FINAL_BYTES) {
        setFileError(t.validation.compressedTooLarge)
        setStage({ kind: 'idle' })
        return
      }
      const ticket = await requestPlanUpload(organizationId, siteId, {
        fileName: upload.name,
        contentType: upload.type,
        sizeBytes: upload.size,
        name,
        description,
      })
      setStage({ kind: 'uploading', progress: 0 })
      await sendToStorage(ticket, upload, (progress) => setStage({ kind: 'uploading', progress }))
      setStage({ kind: 'confirming' })
      onUploaded(await completePlanUpload(organizationId, siteId, ticket.planId))
    } catch (failure) {
      setError(t.error[planErrorKind(failure)])
      setStage({ kind: 'idle' })
    }
  }

  return (
    <Modal title={t.dialog.title} description={t.dialog.body} onClose={busy ? () => {} : onClose}>
      <form className="form plan-upload" onSubmit={(event) => void submit(event)} noValidate>
        <div className="form-field">
          <span className="form-field__label">{t.dialog.file}</span>
          <div className="plan-upload__picker">
            <label className="button" htmlFor={ids.file}>
              {file ? t.dialog.change : t.dialog.choose}
            </label>
            <input
              id={ids.file}
              className="plan-upload__input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              aria-invalid={fileError ? true : undefined}
              aria-describedby={fileError ? `${ids.file}-error` : undefined}
              onChange={(event) => pick(event.target.files?.[0])}
            />
            <span className="plan-upload__file data-mono">
              {file ? `${file.name} · ${formatMessage(t.size, { size: megabytes(file.size) })}` : t.dialog.noFile}
            </span>
          </div>
          {fileError ? (
            <p id={`${ids.file}-error`} className="form-field__error" role="alert">
              {fileError}
            </p>
          ) : null}
          {file && preview ? <img className="plan-upload__preview" src={preview} alt={t.dialog.preview} /> : null}
        </div>

        <div className="form-field">
          <label className="form-field__label" htmlFor={ids.name}>
            {t.dialog.name}
          </label>
          <input
            id={ids.name}
            className="form-field__control"
            value={name}
            placeholder={file ? nameFromFile(file.name) : t.dialog.namePlaceholder}
            disabled={busy}
            aria-invalid={nameIssue ? true : undefined}
            onChange={(event) => setName(event.target.value)}
          />
          {nameIssue ? <p className="form-field__error">{t.validation[nameIssue]}</p> : null}
        </div>

        <div className="form-field">
          <label className="form-field__label" htmlFor={ids.description}>
            {t.dialog.description}
          </label>
          <textarea
            id={ids.description}
            className="form-field__control plan-upload__description"
            value={description}
            placeholder={t.dialog.descriptionPlaceholder}
            rows={2}
            disabled={busy}
            aria-invalid={descriptionIssue ? true : undefined}
            onChange={(event) => setDescription(event.target.value)}
          />
          {descriptionIssue ? <p className="form-field__error">{t.validation[descriptionIssue]}</p> : null}
        </div>

        {stage.kind === 'uploading' ? (
          <progress className="plan-upload__progress" max={1} value={stage.progress} aria-label={t.dialog.title} />
        ) : null}
        {compressedNote ? <p className="plan-upload__note">{compressedNote}</p> : null}
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
            {stageLabel(stage, t.dialog)}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function stageLabel(
  stage: Stage,
  t: { submit: string; compressing: string; uploading: string; confirming: string },
): string {
  if (stage.kind === 'compressing') return t.compressing
  if (stage.kind === 'uploading') return formatMessage(t.uploading, { percent: Math.round(stage.progress * 100) })
  if (stage.kind === 'confirming') return t.confirming
  return t.submit
}

function nameFromFile(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return (dot > 0 ? fileName.slice(0, dot) : fileName).trim().slice(0, 120)
}
