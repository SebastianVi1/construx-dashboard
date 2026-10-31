import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link, useParams } from 'react-router'
import { LoadingState, Notice } from '../../components/page'
import { intlLocales, useLocale } from '../../i18n'
import { downloadWorkbook, exportedRecord } from './excelDownload'
import type { ExcelOp, ExcelRecord, GridSheet } from './excelModel'
import { applyOps } from './excelOps'
import type { SaveQueue, SaveState } from './excelSaveQueue'
import { createSaveQueue } from './excelSaveQueue'
import type { ExcelStore, ExcelStoreError } from './excelStore'
import { parseInWorker } from './excelWorkerClient'
import { ExcelGrid } from './ExcelGrid'
import { SheetTabs } from './SheetTabs'
import { excelErrorMessage, useExcelOwner, useExcelStore } from './useExcelStore'
import './excel.css'

const SAVE_DELAY_MS = 500
const NARROW = '(max-width: 760px)'
const NOT_FOUND = Symbol('notFound')

function subscribeNarrow(onChange: () => void) {
  const query = window.matchMedia(NARROW)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/** Phones get a read-only table: editing a spreadsheet needs room. */
function useNarrow(): boolean {
  return useSyncExternalStore(subscribeNarrow, () => window.matchMedia(NARROW).matches)
}

type Loaded = { record: ExcelRecord; parsed: GridSheet[]; queue: SaveQueue }

/** `/excel/:fileId`: edit one workbook; edits are saved to this browser as they happen. */
export function ExcelEditorPage() {
  const { fileId = '' } = useParams()
  const { locale, messages: m } = useLocale()
  const t = m.excel
  const owner = useExcelOwner()
  const { store, failed } = useExcelStore()
  const narrow = useNarrow()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  // Kept as the cause, not the text, so switching language does not reload the workbook.
  const [loadError, setLoadError] = useState<{ cause: unknown } | null>(null)
  const [dirty, setDirty] = useState(false)
  const [active, setActive] = useState(0)
  const [view, setView] = useState<GridSheet | null>(null)
  const [saveState, setSaveState] = useState<{ state: SaveState; error?: ExcelStoreError }>({ state: 'idle' })
  const [actionError, setActionError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  // The newest record, read by edit and download handlers without waiting for a render.
  const recordRef = useRef<ExcelRecord | null>(null)

  useEffect(() => {
    if (!store) return
    let active = true
    async function load(opened: ExcelStore) {
      const record = await opened.get({ userId: owner.userId, organizationId: owner.organizationId }, fileId)
      if (!record) {
        if (active) setLoadError({ cause: NOT_FOUND })
        return
      }
      const parsed = await parseInWorker(record.original)
      if (!active) return
      const queue = createSaveQueue({
        save: (next) => opened.saveEdits(next),
        schedule: (run) => {
          const timer = setTimeout(run, SAVE_DELAY_MS)
          return () => clearTimeout(timer)
        },
        onState: (state, error) => setSaveState({ state, error }),
      })
      recordRef.current = record
      setLoaded({ record, parsed, queue })
      setDirty(record.dirty)
      setActive(0)
      setView(applyOps(parsed, record.ops)[0] ?? null)
    }
    load(store).catch((cause: unknown) => {
      if (active) setLoadError({ cause })
    })
    return () => {
      active = false
    }
  }, [store, fileId, owner.userId, owner.organizationId])

  // Save what is pending when leaving the page, and warn before closing the tab with unsaved edits.
  const queue = loaded?.queue
  useEffect(() => {
    if (!queue) return
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!queue?.hasUnsaved()) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      void queue.flush()
    }
  }, [queue])

  function edit(ops: ExcelOp[]) {
    const current = recordRef.current
    if (!current) return
    const next = { ...current, ops: [...current.ops, ...ops], dirty: true, updatedAt: Date.now() }
    recordRef.current = next
    setDirty(true)
    queue?.push(next)
  }

  function selectSheet(index: number) {
    if (!loaded || !recordRef.current || index === active) return
    setActive(index)
    setView(applyOps(loaded.parsed, recordRef.current.ops)[index] ?? null)
  }

  async function download() {
    if (!store || !queue || !recordRef.current) return
    setActionError(null)
    setDownloading(true)
    try {
      const snapshot = recordRef.current
      await downloadWorkbook(snapshot)
      // Recorded through the queue, after any edit made while the file was being built.
      const next = exportedRecord(recordRef.current, snapshot.ops.length)
      recordRef.current = next
      setDirty(next.dirty)
      queue.push(next)
      await queue.flush()
    } catch (caught) {
      setActionError(excelErrorMessage(caught, t))
    } finally {
      setDownloading(false)
    }
  }

  if (failed) return <div className="page"><Notice tone="error">{t.storeFailed}</Notice></div>
  if (loadError) {
    return (
      <div className="page">
        <Link className="page-back" to="/excel">{t.back}</Link>
        <Notice tone="error">{loadError.cause === NOT_FOUND ? t.notFound : excelErrorMessage(loadError.cause, t)}</Notice>
      </div>
    )
  }
  if (!loaded || !view) return <LoadingState label={m.workspace.loading} />

  const saveLabel =
    saveState.state === 'pending' || saveState.state === 'saving' ? t.saving
    : saveState.state === 'idle' && dirty ? t.saved
    : null

  return (
    <div className="page excel-editor">
      <Link className="page-back" to="/excel">{t.back}</Link>
      <header className="excel-editor__toolbar">
        <h1 className="excel-editor__name">{loaded.record.name}</h1>
        {dirty ? <span className="badge" data-tone="warning">{t.unexported}</span> : null}
        {saveLabel ? <span className="excel-editor__save" role="status">{saveLabel}</span> : null}
        <button type="button" className="button button--primary" disabled={downloading} onClick={() => void download()}>
          {downloading ? t.downloading : t.download}
        </button>
      </header>

      {saveState.state === 'error' ? (
        <Notice tone="error" action={{ label: m.workspace.retry, onClick: () => void loaded.queue.flush() }}>
          {saveState.error?.reason === 'quota' ? t.quotaFailed : t.saveFailed}
        </Notice>
      ) : null}
      {actionError ? <Notice tone="error">{actionError}</Notice> : null}
      {narrow ? <Notice>{t.readOnlyMobile}</Notice> : null}

      <div className="excel-editor__grid">
        <ExcelGrid
          key={active}
          sheet={view}
          sheetIndex={active}
          readOnly={narrow}
          locale={intlLocales[locale]}
          onOps={edit}
        />
      </div>
      <SheetTabs names={loaded.parsed.map((sheet) => sheet.name)} active={active} label={t.sheetsLabel} onSelect={selectSheet} />
    </div>
  )
}
