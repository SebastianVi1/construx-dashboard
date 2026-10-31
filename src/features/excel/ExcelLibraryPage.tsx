import { useEffect, useId, useState, type DragEvent, type HTMLAttributes } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router'
import { FolderIcon, SpreadsheetIcon } from '../../components/icons'
import { ConfirmDialog } from '../../components/modal'
import { LoadingState, Notice } from '../../components/page'
import { formatMessage, intlLocales, useLocale } from '../../i18n'
import { downloadWorkbook, exportedRecord } from './excelDownload'
import type { DragItem } from './excelDrag'
import { dragKind, dropIssue, ITEM_DRAG_TYPE } from './excelDrag'
import { excelFileIssue, MAX_LIBRARY_FILES } from './excelFile'
import type { ExcelFolder, ExcelLibrary, ExcelRecordSummary } from './excelModel'
import {
  createFolderIssue,
  deleteSummary,
  folderContents,
  folderHref,
  folderPath,
  MAX_FOLDERS,
  moveFolderIssue,
  moveWorkbookIssue,
  newFolderIssue,
  renameFolderIssue,
} from './excelTree'
import { parseInWorker } from './excelWorkerClient'
import { DeleteFolderDialog, FolderNameDialog, MoveDialog } from './ExcelFolderDialogs'
import { excelErrorMessage, useExcelOwner, useExcelStore } from './useExcelStore'
import './excel.css'

type Replace = { file: File; existing: ExcelRecordSummary }
type Naming = { mode: 'create' } | { mode: 'rename'; folder: ExcelFolder }
type Moving = { kind: 'folder'; folder: ExcelFolder } | { kind: 'workbook'; workbook: ExcelRecordSummary }

/** Set on the redirect away from a folder that no longer exists. */
type LibraryState = { folderMissing?: boolean } | null

/**
 * `/excel` and `/excel/folders/:folderId`: the selected company's workbooks and folders,
 * kept in this browser until they move to shared storage.
 */
export function ExcelLibraryPage() {
  const { folderId } = useParams()
  const current = folderId ?? null
  const location = useLocation()
  const { locale, messages: m } = useLocale()
  const t = m.excel
  const owner = useExcelOwner()
  const { store, failed } = useExcelStore()
  const inputId = useId()
  const [library, setLibrary] = useState<ExcelLibrary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [replace, setReplace] = useState<Replace | null>(null)
  const [deleting, setDeleting] = useState<ExcelRecordSummary | null>(null)
  const [deletingFolder, setDeletingFolder] = useState<ExcelFolder | null>(null)
  const [naming, setNaming] = useState<Naming | null>(null)
  const [moving, setMoving] = useState<Moving | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  // The library row being dragged; browsers hide drag data until the drop, so it is kept here.
  const [dragged, setDragged] = useState<DragItem | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    if (!store) return
    let active = true
    store
      .tree(owner.organizationId)
      .then((tree) => {
        if (active) setLibrary(tree)
      })
      .catch((caught: unknown) => {
        if (active) setError(excelErrorMessage(caught, t))
      })
    return () => {
      active = false
    }
  }, [store, owner.organizationId, t])

  const dateFormat = new Intl.DateTimeFormat(intlLocales[locale], { dateStyle: 'medium', timeStyle: 'short' })

  async function refresh() {
    if (store) setLibrary(await store.tree(owner.organizationId))
  }

  /** Runs a folder change; returns the message to show in its dialog, or null once it is done. */
  async function change(action: () => Promise<unknown>): Promise<string | null> {
    try {
      await action()
      await refresh()
      return null
    } catch (caught) {
      return excelErrorMessage(caught, t)
    }
  }

  /** Reads the file in the worker (which also proves it is a real workbook) and stores it in this folder. */
  async function upload(file: File, existing: ExcelRecordSummary | null) {
    if (!store) return
    const original = await file.arrayBuffer()
    const sheets = await parseInWorker(original)
    const now = Date.now()
    await store.put({
      // Reusing the id replaces the old record and its bytes in one transaction.
      id: existing?.id ?? crypto.randomUUID(),
      organizationId: owner.organizationId,
      folderId: existing?.folderId ?? current,
      createdBy: owner.userId,
      name: file.name,
      size: file.size,
      sheetCount: sheets.length,
      original,
      ops: [],
      dirty: false,
      createdAt: now,
      updatedAt: now,
      exportedAt: null,
    })
    await refresh()
  }

  async function pick(file: File | undefined) {
    setError(null)
    if (!file || !library) return
    // Names only clash inside the same folder.
    const siblings = folderContents(library, current).workbooks
    const existing = siblings.find((item) => item.name.toLowerCase() === file.name.toLowerCase()) ?? null
    const issue = excelFileIssue(file, library.workbooks.length, existing !== null)
    if (issue) {
      setError(t.issues[issue])
      return
    }
    if (existing) {
      setDialogError(null)
      setReplace({ file, existing })
      return
    }
    setUploading(true)
    try {
      await upload(file, null)
    } catch (caught) {
      setError(excelErrorMessage(caught, t))
    } finally {
      setUploading(false)
    }
  }

  async function download(item: ExcelRecordSummary) {
    if (!store) return
    setError(null)
    setDownloadingId(item.id)
    try {
      const record = await store.get(owner.organizationId, item.id)
      if (!record) throw new Error('missing')
      await downloadWorkbook(record)
      await store.saveEdits(exportedRecord(record, record.ops.length))
      await refresh()
    } catch (caught) {
      setError(excelErrorMessage(caught, t))
    } finally {
      setDownloadingId(null)
    }
  }

  function drop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    if (dragKind(event.dataTransfer.types) === 'files') void pick(event.dataTransfer.files[0])
  }

  /** Makes a row draggable onto folders and the breadcrumb (desktop; touch screens use the move dialog). */
  function dragSource(item: DragItem): HTMLAttributes<HTMLElement> {
    return {
      draggable: true,
      onDragStart: (event) => {
        event.dataTransfer.setData(ITEM_DRAG_TYPE, item.id)
        event.dataTransfer.effectAllowed = 'move'
        setDragged(item)
      },
      onDragEnd: () => {
        setDragged(null)
        setDropTarget(undefined)
      },
    }
  }

  /** Accepts a dragged row on the folder `targetId` (null for the root) only when the move rules allow it. */
  function dropZone(targetId: string | null): HTMLAttributes<HTMLElement> & { 'data-drop-target'?: true } {
    if (!library || !dragged || dropIssue(library, dragged, targetId)) return {}
    const item = dragged
    return {
      'data-drop-target': dropTarget === targetId || undefined,
      onDragOver: (event) => {
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = 'move'
        setDropTarget(targetId)
      },
      onDragLeave: () => setDropTarget(undefined),
      onDrop: (event) => {
        event.preventDefault()
        event.stopPropagation()
        setDragged(null)
        setDropTarget(undefined)
        void change(() => {
          if (!store) throw new Error('store')
          return item.kind === 'folder'
            ? store.moveFolder(owner.organizationId, item.id, targetId, Date.now())
            : store.moveWorkbook(owner.organizationId, item.id, targetId)
        }).then(setError)
      },
    }
  }

  if (failed) {
    return (
      <div className="page">
        <Notice tone="error">{t.storeFailed}</Notice>
      </div>
    )
  }
  if (!library) {
    if (error) return <div className="page"><Notice tone="error">{error}</Notice></div>
    return <LoadingState label={m.workspace.loading} />
  }

  const path = folderPath(library.folders, current)
  if (current !== null && path.length === 0) {
    return <Navigate to="/excel" replace state={{ folderMissing: true } satisfies LibraryState} />
  }
  const here = path.at(-1) ?? null
  const folderMissing = current === null && (location.state as LibraryState)?.folderMissing
  const contents = folderContents(library, current)
  const createIssue = newFolderIssue(library, current)
  const isEmpty = contents.folders.length === 0 && contents.workbooks.length === 0

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__text">
          <h1>{here?.name ?? t.title}</h1>
          {here ? null : <p>{t.subtitle}</p>}
        </div>
        <div className="button-row">
          <button
            type="button"
            className="button"
            disabled={createIssue !== null}
            title={createIssue ? t.folderIssues[createIssue] : undefined}
            onClick={() => setNaming({ mode: 'create' })}
          >
            {here ? t.newSubfolder : t.newFolder}
          </button>
          <label className="button button--primary" htmlFor={inputId} aria-disabled={uploading || undefined}>
            {uploading ? t.uploading : t.upload}
          </label>
          <input
            id={inputId}
            className="excel-library__input"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={uploading}
            onChange={(event) => {
              void pick(event.target.files?.[0])
              // Lets the same file be picked again after an error or a delete.
              event.target.value = ''
            }}
          />
        </div>
      </header>

      {path.length > 0 ? (
        <nav className="excel-path" aria-label={t.folderPath}>
          <ol>
            <li>
              <Link to="/excel" {...dropZone(null)}>
                {t.title}
              </Link>
            </li>
            {path.length > 1 ? (
              <li className="excel-path__ellipsis" aria-hidden="true">
                …
              </li>
            ) : null}
            {path.map((folder, index) => (
              <li key={folder.id} data-collapsible={index < path.length - 1 || undefined}>
                {index === path.length - 1 ? (
                  <span aria-current="page">{folder.name}</span>
                ) : (
                  <Link to={folderHref(folder.id)} {...dropZone(folder.id)}>
                    {folder.name}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      {folderMissing ? <Notice tone="info">{t.folderMissing}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      <section
        className="excel-library"
        data-dragging={dragging || undefined}
        onDragOver={(event) => {
          if (dragKind(event.dataTransfer.types) !== 'files') return
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
      >
        {isEmpty ? (
          <div className="excel-library__empty">
            {here ? <FolderIcon /> : <SpreadsheetIcon />}
            <p className="excel-library__empty-title">{here ? t.folderEmpty : t.empty}</p>
            <p>{t.dropHint}</p>
          </div>
        ) : (
          <>
            <p className="excel-library__meta">
              {formatMessage(t.limit, { count: library.workbooks.length, max: MAX_LIBRARY_FILES })} ·{' '}
              {formatMessage(t.folderLimit, { count: library.folders.length, max: MAX_FOLDERS })} · {t.localOnly}
            </p>
            <ul className="excel-list">
              {contents.folders.map((folder) => {
                const counts = contents.counts.get(folder.id)
                return (
                  <li
                    key={folder.id}
                    className="excel-list__item"
                    data-kind="folder"
                    data-dragged={dragged?.id === folder.id || undefined}
                    {...dragSource({ kind: 'folder', id: folder.id })}
                    {...dropZone(folder.id)}
                  >
                    <div className="excel-list__text">
                      <FolderIcon className="excel-list__icon" />
                      <Link className="excel-list__name" to={folderHref(folder.id)}>
                        <span className="visually-hidden">{t.folder}: </span>
                        {folder.name}
                      </Link>
                      <span className="excel-list__detail">
                        {formatMessage(t.folderContents, { folders: counts?.folders ?? 0, workbooks: counts?.workbooks ?? 0 })}
                      </span>
                    </div>
                    <div className="button-row">
                      <button type="button" className="button" onClick={() => setNaming({ mode: 'rename', folder })}>
                        {t.rename}
                      </button>
                      <button type="button" className="button" onClick={() => setMoving({ kind: 'folder', folder })}>
                        {t.move}
                      </button>
                      <button
                        type="button"
                        className="button button--danger"
                        onClick={() => {
                          setDialogError(null)
                          setDeletingFolder(folder)
                        }}
                      >
                        {t.delete}
                      </button>
                    </div>
                  </li>
                )
              })}
              {contents.workbooks.map((item) => (
                <li
                  key={item.id}
                  className="excel-list__item"
                  data-dragged={dragged?.id === item.id || undefined}
                  {...dragSource({ kind: 'workbook', id: item.id })}
                >
                  <div className="excel-list__text">
                    <SpreadsheetIcon className="excel-list__icon" />
                    <Link className="excel-list__name" to={`/excel/${item.id}`}>
                      {item.name}
                    </Link>
                    <span className="excel-list__detail">
                      {formatMessage(t.lastEdit, { date: dateFormat.format(item.updatedAt) })} ·{' '}
                      {item.sheetCount === 1 ? t.oneSheet : formatMessage(t.sheets, { count: item.sheetCount })}
                    </span>
                    {item.dirty ? <span className="badge" data-tone="warning">{t.unexported}</span> : null}
                  </div>
                  <div className="button-row">
                    <Link className="button" to={`/excel/${item.id}`}>
                      {t.open}
                    </Link>
                    <button type="button" className="button" disabled={downloadingId !== null} onClick={() => void download(item)}>
                      {downloadingId === item.id ? t.downloading : t.download}
                    </button>
                    <button type="button" className="button" onClick={() => setMoving({ kind: 'workbook', workbook: item })}>
                      {t.move}
                    </button>
                    <button
                      type="button"
                      className="button button--danger"
                      onClick={() => {
                        setDialogError(null)
                        setDeleting(item)
                      }}
                    >
                      {t.delete}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <p className="excel-library__hint">{t.dropHint}</p>
          </>
        )}
      </section>

      {naming ? (
        <FolderNameDialog
          t={t}
          title={naming.mode === 'create' ? (here ? t.newSubfolder : t.newFolder) : formatMessage(t.renameTitle, { name: naming.folder.name })}
          initialName={naming.mode === 'create' ? '' : naming.folder.name}
          confirmLabel={naming.mode === 'create' ? t.create : t.save}
          pendingLabel={naming.mode === 'create' ? t.creating : t.saving}
          issueFor={(name) =>
            naming.mode === 'create'
              ? createFolderIssue(library, current, name)
              : renameFolderIssue(library.folders, naming.folder.id, name)
          }
          onSubmit={async (name) => {
            const failure = await change(() => {
              if (!store) throw new Error('store')
              const now = Date.now()
              return naming.mode === 'create'
                ? store.createFolder({
                    id: crypto.randomUUID(),
                    organizationId: owner.organizationId,
                    parentId: current,
                    name,
                    createdBy: owner.userId,
                    createdAt: now,
                    updatedAt: now,
                  })
                : store.renameFolder(owner.organizationId, naming.folder.id, name, now)
            })
            if (!failure) setNaming(null)
            return failure
          }}
          onClose={() => setNaming(null)}
        />
      ) : null}

      {moving ? (
        <MoveDialog
          t={t}
          name={moving.kind === 'folder' ? moving.folder.name : moving.workbook.name}
          folders={library.folders}
          issueFor={(targetId) =>
            moving.kind === 'folder'
              ? moveFolderIssue(library.folders, moving.folder.id, targetId)
              : moveWorkbookIssue(library, moving.workbook.id, targetId)
          }
          onMove={async (targetId) => {
            const failure = await change(() => {
              if (!store) throw new Error('store')
              return moving.kind === 'folder'
                ? store.moveFolder(owner.organizationId, moving.folder.id, targetId, Date.now())
                : store.moveWorkbook(owner.organizationId, moving.workbook.id, targetId)
            })
            if (!failure) setMoving(null)
            return failure
          }}
          onClose={() => setMoving(null)}
        />
      ) : null}

      {deletingFolder ? (
        <DeleteFolderDialog
          t={t}
          folder={deletingFolder}
          summary={deleteSummary(library, deletingFolder.id)}
          error={dialogError}
          onConfirm={async () => {
            const failure = await change(() => {
              if (!store) throw new Error('store')
              return store.deleteFolder(owner.organizationId, deletingFolder.id)
            })
            if (failure) setDialogError(failure)
            else setDeletingFolder(null)
          }}
          onClose={() => setDeletingFolder(null)}
        />
      ) : null}

      {replace ? (
        <ConfirmDialog
          title={formatMessage(t.replaceTitle, { name: replace.existing.name })}
          body={t.replaceBody}
          confirmLabel={t.replace}
          pendingLabel={t.replacing}
          cancelLabel={t.cancel}
          error={dialogError}
          onConfirm={async () => {
            try {
              await upload(replace.file, replace.existing)
              setReplace(null)
            } catch (caught) {
              setDialogError(excelErrorMessage(caught, t))
            }
          }}
          onClose={() => setReplace(null)}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title={formatMessage(t.deleteTitle, { name: deleting.name })}
          body={t.deleteBody}
          confirmLabel={t.delete}
          pendingLabel={t.deleting}
          cancelLabel={t.cancel}
          error={dialogError}
          onConfirm={async () => {
            try {
              await store?.remove(owner.organizationId, deleting.id)
              await refresh()
              setDeleting(null)
            } catch (caught) {
              setDialogError(excelErrorMessage(caught, t))
            }
          }}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </div>
  )
}
