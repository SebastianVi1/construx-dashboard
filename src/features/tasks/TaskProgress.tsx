import { useState, type FormEvent } from 'react'
import { useRemoteData } from '../../components/data/useRemoteData'
import { Notice } from '../../components/page'
import { formatDateTime, formatMessage, useLocale } from '../../i18n'
import '../../components/form/form.css'
import {
  addProgressNote,
  listProgressNotes,
  noteDraftError,
  progressNoteErrorKind,
  progressNoteMaxLength,
  type ProgressNoteErrorKind,
} from './progressNotesApi'
import type { PhaseRef } from './tasksApi'

/**
 * Progress notes of a task, newest first. The form shows only when the caller may write (`canWrite`); the server
 * still checks every note. Notes are never edited or deleted, so rows have no actions.
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
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<{ kind: 'added' } | { kind: 'error'; error: ProgressNoteErrorKind } | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const invalid = noteDraftError(text)
    if (invalid) {
      setOutcome({ kind: 'error', error: invalid })
      return
    }
    setBusy(true)
    setOutcome(null)
    try {
      const note = await addProgressNote(at, taskId, text)
      notes.update((current) => [note, ...current])
      setText('')
      setOutcome({ kind: 'added' })
    } catch (error) {
      setOutcome({ kind: 'error', error: progressNoteErrorKind(error) })
    } finally {
      setBusy(false)
    }
  }

  const invalid = outcome?.kind === 'error' && (outcome.error === 'empty' || outcome.error === 'tooLong')

  return <section className="page-section task-progress" aria-labelledby="task-progress-title">
    <div className="page-section__header">
      <div><h2 id="task-progress-title">{t.title}</h2><p>{t.description}</p></div>
    </div>
    {canWrite ? <form className="task-progress__form" onSubmit={(event) => void submit(event)} noValidate>
      <div className="form-field" data-state={invalid ? 'invalid' : undefined}>
        <label className="form-field__label" htmlFor="task-progress-text">{t.label}</label>
        <textarea id="task-progress-text" className="form-field__control" rows={3} value={text}
          maxLength={progressNoteMaxLength} placeholder={t.placeholder} disabled={busy}
          aria-invalid={invalid || undefined} aria-describedby="task-progress-footer"
          onChange={(event) => setText(event.target.value)} />
        <div className="form-field__footer" id="task-progress-footer">
          {outcome?.kind === 'error' && invalid ? <p className="form-field__error">{t.error[outcome.error]}</p> : null}
          <span className="form-field__counter">{formatMessage(t.counter, { count: text.length, max: progressNoteMaxLength })}</span>
        </div>
      </div>
      <div className="button-row">
        <button type="submit" className="button button--primary" disabled={busy} aria-busy={busy}>{busy ? t.adding : t.add}</button>
      </div>
    </form> : null}
    {outcome?.kind === 'error' && !invalid ? <Notice tone="error">{t.error[outcome.error]}</Notice> : null}
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
          </li>)}</ol>}
  </section>
}
