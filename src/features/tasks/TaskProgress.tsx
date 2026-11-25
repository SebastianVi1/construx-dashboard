import { useRef, useState, type FormEvent } from 'react'
import { useRemoteData } from '../../components/data/useRemoteData'
import { Notice } from '../../components/page'
import { formatDateTime, formatMessage, useLocale } from '../../i18n'
import { Field } from '../../components/form'
import '../../components/form/form.css'
import { usePhotoUploads } from '../floor-plans/usePhotoUploads'
import { uploadNotePhoto } from './notePhoto'
import {
  addProgressNote,
  listProgressNotes,
  noteDraftError,
  progressNoteErrorKind,
  progressNoteMaxLength,
  progressNoteMaxPhotos,
  type ProgressNote,
  type ProgressNoteErrorKind,
} from './progressNotesApi'
import type { PhaseRef } from './tasksApi'

type Outcome = { kind: 'added' } | { kind: 'error'; error: ProgressNoteErrorKind } | { kind: 'photosPending' } | null

/**
 * Progress notes of a task, newest first: text, photos or both. The form shows only when the caller may write
 * (`canWrite`); the server still checks every note. Photos upload as soon as they are picked, like pin photos,
 * so adding the note only names their keys. Notes are never edited or deleted, so rows have no actions.
 */
export function TaskProgress({ at, taskId, canWrite, viewer }: {
  at: PhaseRef
  taskId: string
  canWrite: boolean
  viewer: string | undefined
}) {
  const { messages: m, locale } = useLocale()
  const t = m.tasks.progress
  const notes = useRemoteData(`${at.organizationId}:${taskId}:progress:${viewer}`, () => listProgressNotes(at, taskId))
  const uploads = usePhotoUploads((file) => uploadNotePhoto(at, taskId, file))
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<Outcome>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const invalid = noteDraftError(text, uploads.items.length)
    if (invalid) {
      setOutcome({ kind: 'error', error: invalid })
      return
    }
    if (!uploads.allDone) {
      setOutcome({ kind: 'photosPending' })
      return
    }
    setBusy(true)
    setOutcome(null)
    try {
      const note = await addProgressNote(at, taskId, text, uploads.keys)
      notes.update((current) => [note, ...current])
      setText('')
      uploads.clear()
      setOutcome({ kind: 'added' })
    } catch (error) {
      setOutcome({ kind: 'error', error: progressNoteErrorKind(error) })
    } finally {
      setBusy(false)
    }
  }

  const fieldError = outcome?.kind === 'error' && (outcome.error === 'empty' || outcome.error === 'tooLong') ? outcome.error : null
  const photoError = outcome?.kind === 'photosPending'
    ? uploads.items.some((item) => item.state === 'uploading') ? t.photosWaiting : t.photosFailed
    : outcome?.kind === 'error' && (outcome.error === 'tooManyPhotos' || outcome.error === 'photoInvalid') ? t.error[outcome.error] : null
  const room = progressNoteMaxPhotos - uploads.items.length

  return <section className="page-section task-progress" aria-labelledby="task-progress-title">
    <div className="page-section__header">
      <div><h2 id="task-progress-title">{t.title}</h2><p>{t.description}</p></div>
    </div>
    {canWrite ? <form className="task-progress__form" onSubmit={(event) => void submit(event)} noValidate>
      <Field config={{ name: 'task-progress-text', label: t.label, type: 'textarea', rows: 3,
        maxLength: progressNoteMaxLength, placeholder: t.placeholder }}
        value={text} error={fieldError ? t.error[fieldError] : undefined} disabled={busy} onChange={setText} />
      <div className="form-field" data-state={photoError ? 'invalid' : undefined}>
        <span className="form-field__label">{formatMessage(t.photosLabel, { count: uploads.items.length, max: progressNoteMaxPhotos })}</span>
        {uploads.items.length > 0 ? <ul className="task-progress__photos">
          {uploads.items.map((item) => <li key={item.id} className="task-progress__photo" data-state={item.state}>
            <img src={item.previewUrl} alt="" />
            {item.state !== 'done' ? <span className="task-progress__photo-state" role="status">
              {item.state === 'uploading' ? t.photoUploading : item.state === 'tooLarge' ? t.photoTooLarge : t.photoFailed}
            </span> : null}
            {item.state === 'failed' ? <button type="button" className="task-progress__photo-retry" onClick={() => uploads.retry(item.id)}>{t.photoRetry}</button> : null}
            <button type="button" className="task-progress__photo-remove" aria-label={t.photoRemove} disabled={busy}
              onClick={() => uploads.remove(item.id)}>×</button>
          </li>)}
        </ul> : null}
        <PhotoPicker label={t.addPhotos} disabled={busy || room <= 0} onPick={(files) => uploads.add(files.slice(0, room))} />
        {photoError ? <p className="form-field__error">{photoError}</p> : null}
      </div>
      <div className="button-row">
        <button type="submit" className="button button--primary" disabled={busy} aria-busy={busy}>{busy ? t.adding : t.add}</button>
      </div>
    </form> : null}
    {outcome?.kind === 'error' && !fieldError && !photoError ? <Notice tone="error">{t.error[outcome.error]}</Notice> : null}
    {outcome?.kind === 'added' ? <Notice tone="success">{t.added}</Notice> : null}
    {notes.status === 'error' ? <Notice tone="error" action={{ label: m.tasks.retry, onClick: notes.reload }}>{t.loadError}</Notice>
      : !notes.data ? <p className="task-progress__status" role="status">{t.loading}</p>
        : notes.data.length === 0 ? <p className="task-progress__status">{t.empty}</p>
          : <ol className="task-progress__list">{notes.data.map((note) => <li className="task-progress__note" key={note.id}>
            <p className="task-progress__meta">
              <span className="task-progress__author">{note.author.name || t.unknownAuthor}</span>
              <time className="data-mono" dateTime={note.createdAt}>{formatDateTime(note.createdAt, locale)}</time>
              {note.source === 'WHATSAPP' ? <span className="badge" data-tone="success">{t.whatsapp}</span> : null}
            </p>
            {note.text ? <p className="task-progress__text">{note.text}</p> : null}
            <NotePhotos note={note} openLabel={t.photoOpen} />
          </li>)}</ol>}
  </section>
}

/** Thumbnails of a saved note; each opens the full-size photo in a new tab. */
function NotePhotos({ note, openLabel }: { note: ProgressNote; openLabel: string }) {
  if (note.photos.length === 0) return null
  return <ul className="task-progress__photos">
    {note.photos.map((photo, index) => <li key={photo.id} className="task-progress__photo">
      <a href={photo.url} target="_blank" rel="noreferrer"
        aria-label={formatMessage(openLabel, { number: index + 1, count: note.photos.length })}>
        <img src={photo.url} alt="" loading="lazy" />
      </a>
    </li>)}
  </ul>
}

/** A button over a hidden file input; phones open the back camera, desktops their file dialog. */
function PhotoPicker({ label, disabled, onPick }: { label: string; disabled: boolean; onPick: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null)
  return <>
    <input ref={input} className="visually-hidden" type="file" accept="image/*" capture="environment" multiple tabIndex={-1}
      onChange={(event) => {
        const files = Array.from(event.target.files ?? [])
        // Let the same file be picked again after a removal
        event.target.value = ''
        if (files.length > 0) onPick(files)
      }} />
    <div><button type="button" className="button button--small" disabled={disabled} onClick={() => input.current?.click()}>{label}</button></div>
  </>
}
