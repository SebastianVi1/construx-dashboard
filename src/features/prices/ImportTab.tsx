import { useEffect, useReducer, useRef, useState, type ChangeEvent, type RefObject } from 'react'
import { useRemoteData } from '../../components/data/useRemoteData'
import { Notice } from '../../components/page'
import { formatDateTime, formatMessage, useLocale, type Messages } from '../../i18n'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { usePermissions } from '../permissions'
import { sendToStorage } from '../plans/plansApi'
import {
  cancelImport,
  confirmImport,
  getImport,
  importErrorKind,
  listImports,
  requestImportUpload,
  startImport,
  type CatalogImport,
  type ImportKind,
} from './catalogImportApi'
import {
  canCancel,
  canConfirm,
  canStartOver,
  checkImportFile,
  combinedProgress,
  formatFileSize,
  initialWizard,
  pollDelay,
  resourceTotals,
  wizardReducer,
} from './importWizard'
import { getCatalog } from './pricesApi'
import { pageRange } from './pricesView'
import { FailurePanel, ImportReport } from './ImportReports'

type PricesMessages = Messages['prices']
type ImportMessages = PricesMessages['importTab']

/**
 * The Importar tab: upload the PU Win+ Presupuesto workbook, and optionally the FASAR workbook, straight to
 * storage, follow the job every two seconds, show the dry-run report or the failure, confirm with the licence
 * statement, and list past imports. `onDone` runs when a job finishes importing, so the page refreshes the
 * catalog summary.
 */
export function ImportTab({ t, onDone }: { t: PricesMessages; onDone?: () => void }) {
  const importText = t.importTab
  const organization = useCurrentOrganization()
  const { can } = usePermissions()
  const canManage = can('MANAGE_PRICES')
  const [state, dispatch] = useReducer(wizardReducer, initialWizard)
  const presupuestoInput = useRef<HTMLInputElement>(null)
  const fasarInput = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<{ presupuesto: File | null; fasar: File | null }>({ presupuesto: null, fasar: null })

  // Come back to the company's running job, whoever started it.
  useEffect(() => {
    if (!canManage) return
    let live = true
    getCatalog(organization.id)
      .then((catalog) => (catalog.activeImport ? getImport(organization.id, catalog.activeImport.id) : null))
      .then((job) => {
        if (live && job) dispatch({ type: 'jobLoaded', job })
      })
      .catch(() => {
        // the picker stays; the history still lists the job
      })
    return () => {
      live = false
    }
  }, [organization.id, canManage])

  // Poll while the server works on the job; each answer arms the next poll.
  const delay = pollDelay(state)
  const jobId = state.step === 'job' ? state.job.id : null
  useEffect(() => {
    if (delay === null || jobId === null) return
    const timer = setTimeout(() => {
      getImport(organization.id, jobId)
        .then((job) => dispatch({ type: 'jobLoaded', job }))
        .catch((error: unknown) => dispatch({ type: 'failed', kind: importErrorKind(error) }))
    }, delay)
    return () => clearTimeout(timer)
  }, [state, delay, jobId, organization.id])

  // A job seen finishing refreshes the catalog summary (the FASAR status badge, the counts).
  const status = state.step === 'job' ? state.job.status : null
  const seenRunning = useRef(false)
  useEffect(() => {
    if (status === 'IMPORTING') seenRunning.current = true
    if (status === 'DONE' && seenRunning.current) {
      seenRunning.current = false
      onDone?.()
    }
  }, [status, onDone])

  if (!canManage) return <Notice>{importText.forbidden}</Notice>

  function loaded(job: CatalogImport) {
    dispatch({ type: 'jobLoaded', job })
  }

  function choose(kind: ImportKind, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const problem = checkImportFile(file, kind)
    if (problem) {
      dispatch({ type: 'failed', kind: problem })
      return
    }
    dispatch({ type: 'reset' })
    setFiles((current) => (kind === 'FASAR' ? { ...current, fasar: file } : { ...current, presupuesto: file }))
  }

  async function upload() {
    const { presupuesto, fasar } = files
    if (!presupuesto) return
    const chosen = fasar ? [presupuesto, fasar] : [presupuesto]
    const sizes = chosen.map((file) => file.size)
    dispatch({ type: 'fileChosen', fileName: chosen.map((file) => file.name).join(' + ') })
    try {
      const ids: string[] = []
      for (const [index, file] of chosen.entries()) {
        const slot = await requestImportUpload(organization.id, file, index === 0 ? 'PRESUPUESTO' : 'FASAR')
        await sendToStorage(slot, file, (fraction) =>
          dispatch({ type: 'progress', fraction: combinedProgress(sizes, index, fraction) }),
        )
        ids.push(slot.uploadId)
      }
      loaded(await startImport(organization.id, ids[0], ids[1] ?? null))
      setFiles({ presupuesto: null, fasar: null })
    } catch (error) {
      dispatch({ type: 'failed', kind: importErrorKind(error) })
    }
  }

  async function act(action: (organizationId: string, importId: string) => Promise<CatalogImport>) {
    if (state.step !== 'job') return
    const id = state.job.id
    dispatch({ type: 'requestStarted' })
    try {
      loaded(await action(organization.id, id))
    } catch (error) {
      const kind = importErrorKind(error)
      if (kind === 'stateConflict') {
        try {
          loaded(await getImport(organization.id, id))
        } catch {
          // keep the screen as it was
        }
      }
      dispatch({ type: 'failed', kind })
    }
  }

  function startOver() {
    dispatch({ type: 'reset' })
  }

  // The history refreshes whenever the job on screen changes state.
  const historyKey = state.step === 'job' ? `${state.job.id}:${state.job.status}` : state.step

  return (
    <section className="page-section prices-import" aria-label={importText.title}>
      <h2>{importText.title}</h2>
      <p className="prices-import__intro">{importText.intro}</p>

      {state.step === 'pick' ? (
        <>
          {state.error ? <Notice tone="error">{importText.error[state.error]}</Notice> : null}
          <FilePicker
            label={importText.presupuestoLabel}
            file={files.presupuesto}
            input={presupuestoInput}
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => choose('PRESUPUESTO', event)}
            onRemove={() => setFiles((current) => ({ ...current, presupuesto: null }))}
            importText={importText}
          />
          <FilePicker
            label={importText.fasarLabel}
            hint={importText.fasarHint}
            file={files.fasar}
            input={fasarInput}
            accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => choose('FASAR', event)}
            onRemove={() => setFiles((current) => ({ ...current, fasar: null }))}
            importText={importText}
          />
          <div className="button-row">
            <button type="button" className="button button--primary" disabled={!files.presupuesto} onClick={upload}>
              {importText.start}
            </button>
          </div>
        </>
      ) : null}

      {state.step === 'uploading' ? (
        <div className="prices-import__progress" aria-live="polite">
          <p>{formatMessage(importText.uploading, { name: state.fileName, percent: Math.round(state.progress * 100) })}</p>
          <progress max={1} value={state.progress} />
        </div>
      ) : null}

      {state.step === 'job' ? (
        <div className="prices-import__job">
          <p className="prices-import__status" aria-live="polite">
            <strong>{importText.status[state.job.status]}</strong>
            {' · '}
            {formatMessage(importText.file, { name: state.job.file.name, size: formatFileSize(state.job.file.sizeBytes) })}
            {state.job.fasarFile ? (
              <>
                {' · '}
                {formatMessage(importText.fasarFile, {
                  name: state.job.fasarFile.name,
                  size: formatFileSize(state.job.fasarFile.sizeBytes),
                })}
              </>
            ) : null}
          </p>
          {state.error ? <Notice tone="error">{importText.error[state.error]}</Notice> : null}
          {delay !== null ? <p className="prices-import__hint">{importText.working}</p> : null}
          {state.job.status === 'FAILED' && state.job.failure ? <FailurePanel failure={state.job.failure} importText={importText} /> : null}
          {state.job.status === 'DONE' ? <Notice tone="success">{importText.done}</Notice> : null}
          {state.job.status === 'CANCELLED' ? <Notice>{importText.cancelled}</Notice> : null}
          {state.job.summary && (state.job.status === 'VALIDATED' || state.job.status === 'DONE') ? (
            <ImportReport summary={state.job.summary} done={state.job.status === 'DONE'} importText={importText} t={t} />
          ) : null}
          {state.job.status === 'VALIDATED' ? (
            <label className="prices-import__licence">
              <input
                type="checkbox"
                checked={state.licenceAccepted}
                onChange={(event) => dispatch({ type: 'licenceToggled', accepted: event.target.checked })}
              />
              <span>{importText.licence}</span>
            </label>
          ) : null}
          <div className="button-row">
            {state.job.status === 'VALIDATED' ? (
              <button type="button" className="button button--primary" disabled={!canConfirm(state)} onClick={() => act(confirmImport)}>
                {importText.confirm}
              </button>
            ) : null}
            {canCancel(state) ? (
              <button type="button" className="button button--danger" onClick={() => act(cancelImport)}>
                {importText.cancel}
              </button>
            ) : null}
            {canStartOver(state) ? (
              <button type="button" className="button" onClick={startOver}>
                {importText.startOver}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <ImportHistory
        organizationId={organization.id}
        refreshKey={historyKey}
        onOpen={(job) => dispatch({ type: 'jobLoaded', job })}
        importText={importText}
      />
    </section>
  )
}

type HistoryProps = { organizationId: string; refreshKey: string; onOpen: (job: CatalogImport) => void; importText: ImportMessages }

/** Past imports newest first: file, who, when, status and the Resource counts; a row reopens its report. */
function ImportHistory({ organizationId, refreshKey, onOpen, importText }: HistoryProps) {
  const { locale } = useLocale()
  const [page, setPage] = useState(0)
  const history = useRemoteData(`${organizationId}:catalog-imports:${page}:${refreshKey}`, () => listImports(organizationId, page), {
    remember: false,
  })
  const data = history.data
  const range = data ? pageRange(data) : null
  const h = importText.history
  return (
    <section className="prices-import__history" aria-label={h.title}>
      <h3>{h.title}</h3>
      {history.status === 'error' && !data ? (
        <Notice tone="error" action={{ label: h.retry, onClick: history.reload }}>
          {h.error}
        </Notice>
      ) : !data ? null : data.totalElements === 0 ? (
        <p className="prices-import__hint">{h.empty}</p>
      ) : (
        <>
          <div className="table-scroll">
            <table className="data-table prices-table">
              <thead>
                <tr>
                  <th scope="col">{h.file}</th>
                  <th scope="col">{h.by}</th>
                  <th scope="col">{h.when}</th>
                  <th scope="col">{h.status}</th>
                  <th scope="col" className="prices-table__number">{importText.outcome.new}</th>
                  <th scope="col" className="prices-table__number">{importText.outcome.costChanged}</th>
                  <th scope="col" className="prices-table__number">{importText.outcome.missingFromFile}</th>
                  <th scope="col"><span className="visually-hidden">{h.open}</span></th>
                </tr>
              </thead>
              <tbody>
                {data.content.map((job) => {
                  const totals = resourceTotals(job)
                  return (
                    <tr key={job.id}>
                      <td>{job.file.name}</td>
                      <td>{job.uploadedBy?.fullName ?? '—'}</td>
                      <td className="data-mono">{formatDateTime(job.createdAt, locale)}</td>
                      <td>{importText.status[job.status]}</td>
                      <td className="data-mono prices-table__number">{totals?.new ?? '—'}</td>
                      <td className="data-mono prices-table__number">{totals?.costChanged ?? '—'}</td>
                      <td className="data-mono prices-table__number">{totals?.missingFromFile ?? '—'}</td>
                      <td>
                        <button type="button" className="button button--small" onClick={() => onOpen(job)}>
                          {h.open}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {range && (range.hasPrevious || range.hasNext) ? (
            <nav className="prices-pager" aria-label={h.title}>
              <span>{formatMessage(h.range, { from: range.from, to: range.to, total: range.total })}</span>
              <button type="button" className="button button--small" disabled={!range.hasPrevious} onClick={() => setPage(page - 1)}>
                {h.previous}
              </button>
              <button type="button" className="button button--small" disabled={!range.hasNext} onClick={() => setPage(page + 1)}>
                {h.next}
              </button>
            </nav>
          ) : null}
        </>
      )}
    </section>
  )
}

function FilePicker({
  label,
  hint,
  file,
  input,
  accept,
  onChange,
  onRemove,
  importText,
}: {
  label: string
  hint?: string
  file: File | null
  input: RefObject<HTMLInputElement | null>
  accept: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  onRemove: () => void
  importText: ImportMessages
}) {
  return (
    <div className="prices-import__file">
      <p className="prices-import__file-label">
        <strong>{label}</strong>
        {hint ? <span className="prices-import__hint"> {hint}</span> : null}
      </p>
      <div className="button-row">
        <button type="button" className="button" onClick={() => input.current?.click()}>
          {importText.pick}
        </button>
        <span aria-live="polite">{file ? `${file.name} · ${formatFileSize(file.size)}` : importText.noFile}</span>
        {file ? (
          <button type="button" className="button button--small" onClick={onRemove}>
            {importText.remove}
          </button>
        ) : null}
        <input ref={input} type="file" hidden accept={accept} onChange={onChange} aria-label={label} />
      </div>
    </div>
  )
}
