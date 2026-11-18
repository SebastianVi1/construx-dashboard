import { useEffect, useReducer, useRef, useState, type ChangeEvent, type RefObject } from 'react'
import { Notice } from '../../components/page'
import { formatMessage, type Messages } from '../../i18n'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { usePermissions } from '../permissions'
import { sendToStorage } from '../plans/plansApi'
import {
  cancelImport,
  confirmImport,
  getImport,
  importErrorKind,
  requestImportUpload,
  startImport,
  type CatalogImport,
  type ImportKind,
  type ImportSummary,
} from './catalogImportApi'
import {
  activeImportKey,
  canCancel,
  canConfirm,
  canStartOver,
  checkImportFile,
  combinedProgress,
  fasarReport,
  formatFileSize,
  initialWizard,
  pollDelay,
  wizardReducer,
} from './importWizard'
import type { ResourceType } from './pricesApi'

type PricesMessages = Messages['prices']
type ImportMessages = PricesMessages['importTab']

const typeTabs: Record<ResourceType, keyof PricesMessages['tab']> = {
  MATERIAL: 'materials',
  LABOR: 'labor',
  EQUIPMENT: 'equipment',
  WORK_ITEM: 'workItems',
}

const outcomes = ['new', 'costChanged', 'unchanged', 'missingFromFile'] as const

function remember(organizationId: string, importId: string | null) {
  try {
    if (importId) localStorage.setItem(activeImportKey(organizationId), importId)
    else localStorage.removeItem(activeImportKey(organizationId))
  } catch {
    // only a convenience: the job keeps running without it
  }
}

function remembered(organizationId: string): string | null {
  try {
    return localStorage.getItem(activeImportKey(organizationId))
  } catch {
    return null
  }
}

/**
 * The Importar tab: upload the PU Win+ Presupuesto workbook, and optionally the FASAR workbook, straight to
 * storage, follow the job every two seconds, show the dry run or the failure, and confirm with the licence
 * statement. `onDone` runs when a job finishes importing, so the page refreshes the catalog summary.
 */
export function ImportTab({ t, onDone }: { t: PricesMessages; onDone?: () => void }) {
  const i = t.importTab
  const organization = useCurrentOrganization()
  const { can } = usePermissions()
  const canManage = can('MANAGE_PRICES')
  const [state, dispatch] = useReducer(wizardReducer, initialWizard)
  const presupuestoInput = useRef<HTMLInputElement>(null)
  const fasarInput = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<{ presupuesto: File | null; fasar: File | null }>({ presupuesto: null, fasar: null })

  // Come back to a job started earlier from this browser.
  useEffect(() => {
    if (!canManage) return
    const id = remembered(organization.id)
    if (!id) return
    let live = true
    getImport(organization.id, id)
      .then((job) => {
        if (live) dispatch({ type: 'jobLoaded', job })
      })
      .catch(() => remember(organization.id, null))
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

  if (!canManage) return <Notice>{i.forbidden}</Notice>

  function loaded(job: CatalogImport) {
    remember(organization.id, ['DONE', 'FAILED', 'CANCELLED'].includes(job.status) ? null : job.id)
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
    remember(organization.id, null)
    dispatch({ type: 'reset' })
  }

  return (
    <section className="page-section prices-import" aria-label={i.title}>
      <h2>{i.title}</h2>
      <p className="prices-import__intro">{i.intro}</p>

      {state.step === 'pick' ? (
        <>
          {state.error ? <Notice tone="error">{i.error[state.error]}</Notice> : null}
          <FilePicker
            label={i.presupuestoLabel}
            file={files.presupuesto}
            input={presupuestoInput}
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => choose('PRESUPUESTO', event)}
            onRemove={() => setFiles((current) => ({ ...current, presupuesto: null }))}
            i={i}
          />
          <FilePicker
            label={i.fasarLabel}
            hint={i.fasarHint}
            file={files.fasar}
            input={fasarInput}
            accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => choose('FASAR', event)}
            onRemove={() => setFiles((current) => ({ ...current, fasar: null }))}
            i={i}
          />
          <div className="button-row">
            <button type="button" className="button button--primary" disabled={!files.presupuesto} onClick={upload}>
              {i.start}
            </button>
          </div>
        </>
      ) : null}

      {state.step === 'uploading' ? (
        <div className="prices-import__progress" aria-live="polite">
          <p>{formatMessage(i.uploading, { name: state.fileName, percent: Math.round(state.progress * 100) })}</p>
          <progress max={1} value={state.progress} />
        </div>
      ) : null}

      {state.step === 'job' ? (
        <div className="prices-import__job">
          <p className="prices-import__status" aria-live="polite">
            <strong>{i.status[state.job.status]}</strong>
            {' · '}
            {formatMessage(i.file, { name: state.job.file.name, size: formatFileSize(state.job.file.sizeBytes) })}
            {state.job.fasarFile ? (
              <>
                {' · '}
                {formatMessage(i.fasarFile, {
                  name: state.job.fasarFile.name,
                  size: formatFileSize(state.job.fasarFile.sizeBytes),
                })}
              </>
            ) : null}
          </p>
          {state.error ? <Notice tone="error">{i.error[state.error]}</Notice> : null}
          {delay !== null ? <p className="prices-import__hint">{i.working}</p> : null}
          {state.job.status === 'FAILED' && state.job.failure ? <FailurePanel failure={state.job.failure} i={i} /> : null}
          {state.job.status === 'DONE' ? <Notice tone="success">{i.done}</Notice> : null}
          {state.job.status === 'CANCELLED' ? <Notice>{i.cancelled}</Notice> : null}
          {state.job.summary && (state.job.status === 'VALIDATED' || state.job.status === 'DONE') ? (
            <DryRun summary={state.job.summary} i={i} t={t} />
          ) : null}
          {state.job.status === 'VALIDATED' ? (
            <label className="prices-import__licence">
              <input
                type="checkbox"
                checked={state.licenceAccepted}
                onChange={(event) => dispatch({ type: 'licenceToggled', accepted: event.target.checked })}
              />
              <span>{i.licence}</span>
            </label>
          ) : null}
          <div className="button-row">
            {state.job.status === 'VALIDATED' ? (
              <button type="button" className="button button--primary" disabled={!canConfirm(state)} onClick={() => act(confirmImport)}>
                {i.confirm}
              </button>
            ) : null}
            {canCancel(state) ? (
              <button type="button" className="button button--danger" onClick={() => act(cancelImport)}>
                {i.cancel}
              </button>
            ) : null}
            {canStartOver(state) ? (
              <button type="button" className="button" onClick={startOver}>
                {i.startOver}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
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
  i,
}: {
  label: string
  hint?: string
  file: File | null
  input: RefObject<HTMLInputElement | null>
  accept: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  onRemove: () => void
  i: ImportMessages
}) {
  return (
    <div className="prices-import__file">
      <p className="prices-import__file-label">
        <strong>{label}</strong>
        {hint ? <span className="prices-import__hint"> {hint}</span> : null}
      </p>
      <div className="button-row">
        <button type="button" className="button" onClick={() => input.current?.click()}>
          {i.pick}
        </button>
        <span aria-live="polite">{file ? `${file.name} · ${formatFileSize(file.size)}` : i.noFile}</span>
        {file ? (
          <button type="button" className="button button--small" onClick={onRemove}>
            {i.remove}
          </button>
        ) : null}
        <input ref={input} type="file" hidden accept={accept} onChange={onChange} aria-label={label} />
      </div>
    </div>
  )
}

function FailurePanel({ failure, i }: { failure: NonNullable<CatalogImport['failure']>; i: ImportMessages }) {
  const known = failure.code in i.failure ? (failure.code as keyof ImportMessages['failure']) : 'other'
  const where = failure.sheet
    ? formatMessage(i.location, { sheet: failure.sheet, row: failure.row ?? '-', column: failure.column ?? '-' })
    : null
  return (
    <div className="notice prices-import__failure" data-tone="error" role="alert">
      <strong>{i.failureTitle}</strong>
      <p>
        {i.failure[known]} <code>{failure.code}</code>
      </p>
      {where ? <p>{where}</p> : null}
      {failure.message ? <p lang="es">{failure.message}</p> : null}
    </div>
  )
}

function DryRun({ summary, i, t }: { summary: ImportSummary; i: ImportMessages; t: PricesMessages }) {
  const types = Object.keys(typeTabs) as ResourceType[]
  return (
    <div className="prices-import__summary">
      <h3>{i.dryRun}</h3>
      <div className="table-scroll">
        <table className="data-table prices-table">
          <caption>{i.resourcesCaption}</caption>
          <thead>
            <tr>
              <th scope="col">{i.type}</th>
              {outcomes.map((outcome) => (
                <th key={outcome} scope="col" className="prices-table__number">
                  {i.outcome[outcome]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {types.map((type) => (
              <tr key={type}>
                <th scope="row">{t.tab[typeTabs[type]]}</th>
                {outcomes.map((outcome) => (
                  <td key={outcome} className="prices-table__number">
                    {summary.resources[type][outcome]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        {formatMessage(i.lists, {
          unitsNew: summary.units.new,
          unitsSame: summary.units.unchanged,
          familiesNew: summary.families.new,
          familiesSame: summary.families.unchanged,
          suppliersNew: summary.suppliers.new,
          suppliersSame: summary.suppliers.unchanged,
        })}
      </p>
      <p>
        {i.rows}:{' '}
        {Object.entries(summary.rows)
          .map(([sheet, count]) => `${sheet} ${count}`)
          .join(' · ')}
      </p>
      <FasarSection summary={summary} i={i} />
      <p>{formatMessage(i.warnings, { count: summary.warnings.total })}</p>
    </div>
  )
}

function FasarSection({ summary, i }: { summary: ImportSummary; i: ImportMessages }) {
  const report = fasarReport(summary)
  if (!report) return <p>{i.fasarNone}</p>
  const rows: [string, string | number][] = [
    [i.fasarYear, report.year ?? '-'],
    [i.fasarUma, report.uma ?? '-'],
    [i.fasarMinimumWage, report.minimumWage ?? '-'],
    [i.fasarCategories, report.categories],
    [i.fasarFsrMismatches, report.fsrMismatches],
    [i.fasarRealWageMismatches, report.realWageMismatches],
  ]
  return (
    <section className="prices-import__fasar" aria-label={i.fasarTitle}>
      <h4>{i.fasarTitle}</h4>
      <p>{i.fasarReplaces}</p>
      <dl className="prices-import__facts">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {report.fsrMismatches + report.realWageMismatches > 0 ? <p className="prices-import__hint">{i.fasarMismatchHint}</p> : null}
      {report.warnings.map((warning) => (
        <Notice key={warning.code}>{formatMessage(i.fasarWarning[warning.code], { count: warning.count })}</Notice>
      ))}
    </section>
  )
}
