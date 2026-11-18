import { useEffect, useReducer, useRef, useState, type ChangeEvent, type RefObject } from 'react'
import { useRemoteData } from '../../components/data/useRemoteData'
import { Notice } from '../../components/page'
import { useCurrency } from '../../currency'
import { formatMessage, intlLocales, useLocale, type Messages } from '../../i18n'
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
  type ImportSummary,
} from './catalogImportApi'
import { formatDetail, warningGroups } from './importReport'
import {
  canCancel,
  canConfirm,
  canStartOver,
  checkImportFile,
  combinedProgress,
  fasarReport,
  formatFileSize,
  initialWizard,
  pollDelay,
  resourceTotals,
  wizardReducer,
} from './importWizard'
import { getCatalog, type ResourceType } from './pricesApi'
import { pageRange } from './pricesView'

type PricesMessages = Messages['prices']
type ImportMessages = PricesMessages['importTab']

const typeTabs: Record<ResourceType, keyof PricesMessages['tab']> = {
  MATERIAL: 'materials',
  LABOR: 'labor',
  EQUIPMENT: 'equipment',
  WORK_ITEM: 'workItems',
}

const outcomes = ['new', 'costChanged', 'unchanged', 'missingFromFile'] as const

/**
 * The Importar tab: upload the PU Win+ Presupuesto workbook, and optionally the FASAR workbook, straight to
 * storage, follow the job every two seconds, show the dry-run report or the failure, confirm with the licence
 * statement, and list past imports. `onDone` runs when a job finishes importing, so the page refreshes the
 * catalog summary.
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

  if (!canManage) return <Notice>{i.forbidden}</Notice>

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
            <ImportReport summary={state.job.summary} done={state.job.status === 'DONE'} i={i} t={t} />
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

      <ImportHistory
        organizationId={organization.id}
        refreshKey={historyKey}
        onOpen={(job) => dispatch({ type: 'jobLoaded', job })}
        i={i}
      />
    </section>
  )
}

type HistoryProps = { organizationId: string; refreshKey: string; onOpen: (job: CatalogImport) => void; i: ImportMessages }

/** Past imports newest first: file, who, when, status and the Resource counts; a row reopens its report. */
function ImportHistory({ organizationId, refreshKey, onOpen, i }: HistoryProps) {
  const { locale } = useLocale()
  const [page, setPage] = useState(0)
  const history = useRemoteData(`${organizationId}:catalog-imports:${page}:${refreshKey}`, () => listImports(organizationId, page), {
    remember: false,
  })
  const date = new Intl.DateTimeFormat(intlLocales[locale], { dateStyle: 'medium', timeStyle: 'short' })
  const data = history.data
  const range = data ? pageRange(data) : null
  const h = i.history
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
                  <th scope="col" className="prices-table__number">{i.outcome.new}</th>
                  <th scope="col" className="prices-table__number">{i.outcome.costChanged}</th>
                  <th scope="col" className="prices-table__number">{i.outcome.missingFromFile}</th>
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
                      <td className="data-mono">{date.format(new Date(job.createdAt))}</td>
                      <td>{i.status[job.status]}</td>
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

type ReportProps = { summary: ImportSummary; done: boolean; i: ImportMessages; t: PricesMessages }

/** The dry-run report, or what the finished import did: counts, FASAR, warnings by code and samples. */
function ImportReport({ summary, done, i, t }: ReportProps) {
  const types = Object.keys(typeTabs) as ResourceType[]
  const r = i.report
  return (
    <div className="prices-import__summary">
      <h3>{done ? r.doneTitle : i.dryRun}</h3>
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
      <FasarReport summary={summary} i={i} />
      <WarningsReport summary={summary} i={i} />
      <ChangesReport summary={summary} i={i} t={t} />
      <MissingReport summary={summary} i={i} t={t} />
    </div>
  )
}

function FasarReport({ summary, i }: { summary: ImportSummary; i: ImportMessages }) {
  const r = i.report
  const fasar = summary.fasar
  const report = fasarReport(summary)
  return (
    <section className="prices-import__block" aria-label={r.fasarTitle}>
      <h4>{r.fasarTitle}</h4>
      <p>{fasar.provided ? r.fasarProvided : i.fasarNone}</p>
      {fasar.provided ? <p>{i.fasarReplaces}</p> : null}
      <dl className="prices-import__facts">
        <dt>{r.year}</dt>
        <dd>{fasar.year ?? '—'}</dd>
        <dt>{r.uma}</dt>
        <dd className="data-mono">{fasar.uma ?? '—'}</dd>
        <dt>{r.minimumWage}</dt>
        <dd className="data-mono">{fasar.minimumWage ?? '—'}</dd>
        <dt>{r.laborCategories}</dt>
        <dd>{fasar.laborCategories}</dd>
        <dt>{r.fsrMismatches}</dt>
        <dd>{fasar.fsrMismatches}</dd>
        <dt>{r.realWageMismatches}</dt>
        <dd>{fasar.realWageMismatches}</dd>
      </dl>
      {report && report.fsrMismatches + report.realWageMismatches > 0 ? (
        <p className="prices-import__hint">{i.fasarMismatchHint}</p>
      ) : null}
      {report?.warnings.map((warning) => (
        <Notice key={warning.code}>{formatMessage(i.fasarWarning[warning.code], { count: warning.count })}</Notice>
      ))}
    </section>
  )
}

function WarningsReport({ summary, i }: { summary: ImportSummary; i: ImportMessages }) {
  const r = i.report
  const groups = warningGroups(summary.warnings)
  return (
    <section className="prices-import__block" aria-label={r.warningsTitle}>
      <h4>{formatMessage(i.warnings, { count: summary.warnings.total })}</h4>
      {groups.length === 0 ? <p className="prices-import__hint">{r.noWarnings}</p> : null}
      {groups.map((group) => (
        <details key={group.code} className="prices-import__warning">
          <summary>
            <strong>{group.code in r.warning ? r.warning[group.code as keyof ImportMessages['report']['warning']] : group.code}</strong>
            {' · '}
            {group.count}
          </summary>
          {group.samples.length === 0 ? (
            <p className="prices-import__hint">{r.noSamples}</p>
          ) : (
            <div className="table-scroll">
              <table className="data-table prices-table">
                <thead>
                  <tr>
                    <th scope="col">{r.sheet}</th>
                    <th scope="col" className="prices-table__number">{r.row}</th>
                    <th scope="col">{r.resourceCode}</th>
                    <th scope="col">{r.detail}</th>
                  </tr>
                </thead>
                <tbody>
                  {group.samples.map((sample, index) => (
                    <tr key={`${sample.sheet}:${sample.row}:${index}`}>
                      <td>{sample.sheet ?? '—'}</td>
                      <td className="data-mono prices-table__number">{sample.row ?? '—'}</td>
                      <td className="data-mono">{sample.resourceCode ?? '—'}</td>
                      <td className="data-mono">{formatDetail(sample.detail) || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {group.samples.length < group.count ? (
            <p className="prices-import__hint">{formatMessage(r.sampleOf, { shown: group.samples.length, total: group.count })}</p>
          ) : null}
        </details>
      ))}
    </section>
  )
}

function ChangesReport({ summary, i, t }: { summary: ImportSummary; i: ImportMessages; t: PricesMessages }) {
  const { money } = useCurrency()
  const r = i.report
  const sample = summary.changes.sample
  const total = resourceTotal(summary, 'costChanged')
  return (
    <section className="prices-import__block" aria-label={r.changesTitle}>
      <h4>{formatMessage(r.changesTitle, { count: total })}</h4>
      {sample.length === 0 ? (
        <p className="prices-import__hint">{r.noChanges}</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table prices-table">
            <thead>
              <tr>
                <th scope="col">{t.column.code}</th>
                <th scope="col">{t.column.name}</th>
                <th scope="col">{i.type}</th>
                <th scope="col" className="prices-table__number">{r.from}</th>
                <th scope="col" className="prices-table__number">{r.to}</th>
              </tr>
            </thead>
            <tbody>
              {sample.map((change) => (
                <tr key={change.resourceCode}>
                  <td className="data-mono">{change.resourceCode}</td>
                  <td>{change.name}</td>
                  <td>{t.tab[typeTabs[change.type]]}</td>
                  <td className="data-mono prices-table__number">{change.from === null ? '—' : money(change.from)}</td>
                  <td className="data-mono prices-table__number">{change.to === null ? '—' : money(change.to)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {sample.length < total ? <p className="prices-import__hint">{formatMessage(r.sampleOf, { shown: sample.length, total })}</p> : null}
    </section>
  )
}

function MissingReport({ summary, i, t }: { summary: ImportSummary; i: ImportMessages; t: PricesMessages }) {
  const r = i.report
  const sample = summary.missingFromFile.sample
  const total = resourceTotal(summary, 'missingFromFile')
  return (
    <section className="prices-import__block" aria-label={r.missingTitle}>
      <h4>{formatMessage(r.missingTitle, { count: total })}</h4>
      {sample.length === 0 ? (
        <p className="prices-import__hint">{r.noMissing}</p>
      ) : (
        <>
          <p className="prices-import__hint">{r.missingHint}</p>
          <div className="table-scroll">
            <table className="data-table prices-table">
              <thead>
                <tr>
                  <th scope="col">{t.column.code}</th>
                  <th scope="col">{t.column.name}</th>
                  <th scope="col">{i.type}</th>
                </tr>
              </thead>
              <tbody>
                {sample.map((missing) => (
                  <tr key={missing.resourceCode}>
                    <td className="data-mono">{missing.resourceCode}</td>
                    <td>{missing.name}</td>
                    <td>{t.tab[typeTabs[missing.type]]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {sample.length < total ? <p className="prices-import__hint">{formatMessage(r.sampleOf, { shown: sample.length, total })}</p> : null}
    </section>
  )
}

function resourceTotal(summary: ImportSummary, outcome: (typeof outcomes)[number]): number {
  return Object.values(summary.resources).reduce((sum, counts) => sum + counts[outcome], 0)
}
