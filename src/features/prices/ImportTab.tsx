import { useEffect, useReducer, useRef, type ChangeEvent } from 'react'
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
  type ImportSummary,
} from './catalogImportApi'
import {
  activeImportKey,
  canCancel,
  canConfirm,
  canStartOver,
  checkImportFile,
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
 * The Importar tab: upload the PU Win+ Presupuesto workbook straight to storage, follow the job every two
 * seconds, show the dry run or the failure, and confirm with the licence statement.
 */
export function ImportTab({ t }: { t: PricesMessages }) {
  const i = t.importTab
  const organization = useCurrentOrganization()
  const { can } = usePermissions()
  const canManage = can('MANAGE_PRICES')
  const [state, dispatch] = useReducer(wizardReducer, initialWizard)
  const fileInput = useRef<HTMLInputElement>(null)

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

  if (!canManage) return <Notice>{i.forbidden}</Notice>

  function loaded(job: CatalogImport) {
    remember(organization.id, ['DONE', 'FAILED', 'CANCELLED'].includes(job.status) ? null : job.id)
    dispatch({ type: 'jobLoaded', job })
  }

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const problem = checkImportFile(file)
    if (problem) {
      dispatch({ type: 'failed', kind: problem })
      return
    }
    dispatch({ type: 'fileChosen', fileName: file.name })
    try {
      const slot = await requestImportUpload(organization.id, file)
      await sendToStorage(slot, file, (fraction) => dispatch({ type: 'progress', fraction }))
      loaded(await startImport(organization.id, slot.uploadId))
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
          <div className="button-row">
            <button type="button" className="button button--primary" onClick={() => fileInput.current?.click()}>
              {i.pick}
            </button>
            <input
              ref={fileInput}
              type="file"
              hidden
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={choose}
            />
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
      <p>
        {summary.fasar.provided
          ? formatMessage(i.fasarProvided, {
              year: summary.fasar.year ?? '-',
              categories: summary.fasar.laborCategories,
              mismatches: summary.fasar.fsrMismatches + summary.fasar.realWageMismatches,
            })
          : i.fasarNone}
      </p>
      <p>{formatMessage(i.warnings, { count: summary.warnings.total })}</p>
    </div>
  )
}
