import { useId, useState } from 'react'
import { ConfirmDialog, Modal } from '../../components/modal'
import { formatMessage, type Messages } from '../../i18n'
import type { ExcelFolder } from './excelModel'
import type { DeleteSummary, TreeIssue } from './excelTree'
import { folderPath } from './excelTree'
import '../../components/form/form.css'

type Copy = Messages['excel']

/** Creates or renames a folder; `issueFor` runs the same rule the store checks, so errors show while typing. */
export function FolderNameDialog({
  t,
  title,
  initialName,
  confirmLabel,
  pendingLabel,
  issueFor,
  onSubmit,
  onClose,
}: {
  t: Copy
  title: string
  initialName: string
  confirmLabel: string
  pendingLabel: string
  issueFor: (name: string) => TreeIssue | null
  /** Resolves with an error message to show, or null when done. */
  onSubmit: (name: string) => Promise<string | null>
  onClose: () => void
}) {
  const inputId = useId()
  const [name, setName] = useState(initialName)
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const issue = issueFor(name)
  const shownIssue = touched && issue ? t.folderIssues[issue] : null

  async function submit() {
    setTouched(true)
    if (issue || busy) return
    setBusy(true)
    setError(await onSubmit(name))
    setBusy(false)
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <div className="form-field" data-state={shownIssue ? 'invalid' : undefined}>
          <label className="form-field__label" htmlFor={inputId}>
            {t.folderName}
          </label>
          <input
            id={inputId}
            className="form-field__control"
            value={name}
            maxLength={120}
            autoFocus
            disabled={busy}
            aria-invalid={shownIssue ? true : undefined}
            onChange={(event) => {
              setTouched(true)
              setName(event.target.value)
            }}
          />
          {shownIssue ? <p className="form-field__error">{shownIssue}</p> : null}
        </div>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="button-row button-row--end modal-actions">
          <button type="button" className="button" onClick={onClose} disabled={busy}>
            {t.cancel}
          </button>
          <button type="submit" className="button button--primary" disabled={busy || (touched && issue !== null)}>
            {busy ? pendingLabel : confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/**
 * Picks a destination folder. Every folder is listed indented under its parent; a destination
 * the rules refuse is disabled and says why.
 */
export function MoveDialog({
  t,
  name,
  folders,
  issueFor,
  onMove,
  onClose,
}: {
  t: Copy
  name: string
  folders: ExcelFolder[]
  issueFor: (targetId: string | null) => TreeIssue | null
  /** Resolves with an error message to show, or null when done. */
  onMove: (targetId: string | null) => Promise<string | null>
  onClose: () => void
}) {
  const [selected, setSelected] = useState<string | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const destinations: { id: string | null; label: string; level: number }[] = [
    { id: null, label: t.root, level: 0 },
    ...ordered(folders).map((folder) => ({ id: folder.id, label: folder.name, level: folderPath(folders, folder.id).length })),
  ]

  async function move() {
    if (selected === undefined || busy) return
    setBusy(true)
    setError(await onMove(selected))
    setBusy(false)
  }

  return (
    <Modal title={formatMessage(t.moveTitle, { name })} onClose={onClose}>
      <ul className="excel-move" role="listbox" aria-label={t.move}>
        {destinations.map((destination) => {
          const issue = issueFor(destination.id)
          const isSelected = selected === destination.id
          return (
            <li key={destination.id ?? 'root'}>
              <button
                type="button"
                role="option"
                className="excel-move__option"
                style={{ paddingInlineStart: `${12 + destination.level * 20}px` }}
                aria-selected={isSelected}
                aria-disabled={issue ? true : undefined}
                disabled={issue !== null || busy}
                onClick={() => setSelected(destination.id)}
              >
                <span className="excel-move__name">{destination.label}</span>
                {issue ? <span className="excel-move__reason">{t.folderIssues[issue]}</span> : null}
              </button>
            </li>
          )
        })}
      </ul>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="button-row button-row--end modal-actions">
        <button type="button" className="button" onClick={onClose} disabled={busy}>
          {t.cancel}
        </button>
        <button
          type="button"
          className="button button--primary"
          disabled={selected === undefined || busy}
          onClick={() => void move()}
        >
          {busy ? t.moving : t.moveHere}
        </button>
      </div>
    </Modal>
  )
}

/** Recursive delete: states what goes and asks for the folder name before it can run. */
export function DeleteFolderDialog({
  t,
  folder,
  summary,
  error,
  onConfirm,
  onClose,
}: {
  t: Copy
  folder: ExcelFolder
  summary: DeleteSummary
  error: string | null
  onConfirm: () => Promise<void>
  onClose: () => void
}) {
  const inputId = useId()
  const [typed, setTyped] = useState('')
  const matches = typed.trim().toLocaleLowerCase() === folder.name.toLocaleLowerCase()

  return (
    <ConfirmDialog
      title={formatMessage(t.deleteFolderTitle, { name: folder.name })}
      body={t.deleteFolderBody}
      confirmLabel={t.delete}
      pendingLabel={t.deleting}
      cancelLabel={t.cancel}
      error={error}
      confirmDisabled={!matches}
      onConfirm={onConfirm}
      onClose={onClose}
    >
      <p className="excel-delete__summary">
        {formatMessage(t.deleteFolderSummary, {
          folders: summary.subfolders,
          workbooks: summary.workbookIds.length,
          unexported: summary.unexported,
        })}
      </p>
      <div className="form-field">
        <label className="form-field__label" htmlFor={inputId}>
          {formatMessage(t.typeToConfirm, { name: folder.name })}
        </label>
        <input
          id={inputId}
          className="form-field__control"
          value={typed}
          autoComplete="off"
          onChange={(event) => setTyped(event.target.value)}
        />
      </div>
    </ConfirmDialog>
  )
}

/** Depth-first, siblings by name: the order of an expanded folder tree. */
function ordered(folders: ExcelFolder[], parentId: string | null = null): ExcelFolder[] {
  return folders
    .filter((folder) => folder.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
    .flatMap((folder) => [folder, ...ordered(folders, folder.id)])
}
