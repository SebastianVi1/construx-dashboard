import { useEffect, useId, useState, type DragEvent } from 'react'
import { Link } from 'react-router'
import { SpreadsheetIcon } from '../../components/icons'
import { ConfirmDialog } from '../../components/modal'
import { LoadingState, Notice } from '../../components/page'
import { formatMessage, intlLocales, useLocale } from '../../i18n'
import { downloadWorkbook, exportedRecord } from './excelDownload'
import { excelFileIssue, MAX_LIBRARY_FILES } from './excelFile'
import type { ExcelRecordSummary } from './excelModel'
import { parseInWorker } from './excelWorkerClient'
import { excelErrorMessage, useExcelOwner, useExcelStore } from './useExcelStore'
import './excel.css'

type Replace = { file: File; existing: ExcelRecordSummary }

/** `/excel`: the workbooks this user keeps in this browser for the selected company. */
export function ExcelLibraryPage() {
  const { locale, messages: m } = useLocale()
  const t = m.excel
  const owner = useExcelOwner()
  const { store, failed } = useExcelStore()
  const inputId = useId()
  const [items, setItems] = useState<ExcelRecordSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [replace, setReplace] = useState<Replace | null>(null)
  const [deleting, setDeleting] = useState<ExcelRecordSummary | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (!store) return
    let active = true
    store
      .list({ userId: owner.userId, organizationId: owner.organizationId })
      .then((list) => {
        if (active) setItems(list)
      })
      .catch((caught: unknown) => {
        if (active) setError(excelErrorMessage(caught, t))
      })
    return () => {
      active = false
    }
  }, [store, owner.userId, owner.organizationId, t])

  const dateFormat = new Intl.DateTimeFormat(intlLocales[locale], { dateStyle: 'medium', timeStyle: 'short' })

  async function refresh() {
    if (store) setItems(await store.list(owner))
  }

  /** Reads the file in the worker (which also proves it is a real workbook) and stores it. */
  async function upload(file: File, existing: ExcelRecordSummary | null) {
    if (!store) return
    const original = await file.arrayBuffer()
    const sheets = await parseInWorker(original)
    const now = Date.now()
    await store.put({
      // Reusing the id replaces the old record and its bytes in one transaction.
      id: existing?.id ?? crypto.randomUUID(),
      ...owner,
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
    if (!file || !items) return
    const existing = items.find((item) => item.name.toLowerCase() === file.name.toLowerCase()) ?? null
    const issue = excelFileIssue(file, items.length, existing !== null)
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
      const record = await store.get(owner, item.id)
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
    void pick(event.dataTransfer.files[0])
  }

  if (failed) {
    return (
      <div className="page">
        <Notice tone="error">{t.storeFailed}</Notice>
      </div>
    )
  }
  if (!items) {
    if (error) return <div className="page"><Notice tone="error">{error}</Notice></div>
    return <LoadingState label={m.workspace.loading} />
  }

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__text">
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </div>
        <div className="button-row">
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

      {error ? <Notice tone="error">{error}</Notice> : null}

      <section
        className="excel-library"
        data-dragging={dragging || undefined}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
      >
        {items.length === 0 ? (
          <div className="excel-library__empty">
            <SpreadsheetIcon />
            <p className="excel-library__empty-title">{t.empty}</p>
            <p>{t.dropHint}</p>
          </div>
        ) : (
          <>
            <p className="excel-library__meta">
              {formatMessage(t.limit, { count: items.length, max: MAX_LIBRARY_FILES })} · {t.localOnly}
            </p>
            <ul className="excel-list">
              {items.map((item) => (
                <li key={item.id} className="excel-list__item">
                  <div className="excel-list__text">
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
              await store?.remove(owner, deleting.id)
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
