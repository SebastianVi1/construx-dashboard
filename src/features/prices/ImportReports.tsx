import { Notice } from '../../components/page'
import { useCurrency } from '../../currency'
import { formatMessage, type Messages } from '../../i18n'
import type { CatalogImport, ImportSummary } from './catalogImportApi'
import { formatDetail, warningGroups } from './importReport'
import { fasarReport } from './importWizard'
import type { ResourceType } from './pricesApi'

/* The panels of an import job on the Importar tab: its failure, or its dry-run / finished report. */

type PricesMessages = Messages['prices']
type ImportMessages = PricesMessages['importTab']

const typeTabs: Record<ResourceType, keyof PricesMessages['tab']> = {
  MATERIAL: 'materials',
  LABOR: 'labor',
  EQUIPMENT: 'equipment',
  WORK_ITEM: 'workItems',
}

const outcomes = ['new', 'costChanged', 'unchanged', 'missingFromFile'] as const

type FailureProps = { failure: NonNullable<CatalogImport['failure']>; importText: ImportMessages }

/** Why the job failed: the translated code, where in the workbook, and the server's Spanish message. */
export function FailurePanel({ failure, importText }: FailureProps) {
  const known = failure.code in importText.failure ? (failure.code as keyof ImportMessages['failure']) : 'other'
  const where = failure.sheet
    ? formatMessage(importText.location, { sheet: failure.sheet, row: failure.row ?? '-', column: failure.column ?? '-' })
    : null
  return (
    <div className="notice prices-import__failure" data-tone="error" role="alert">
      <strong>{importText.failureTitle}</strong>
      <p>
        {importText.failure[known]} <code>{failure.code}</code>
      </p>
      {where ? <p>{where}</p> : null}
      {failure.message ? <p lang="es">{failure.message}</p> : null}
    </div>
  )
}

type ReportProps = { summary: ImportSummary; done: boolean; importText: ImportMessages; t: PricesMessages }

/** The dry-run report, or what the finished import did: counts, FASAR, warnings by code and samples. */
export function ImportReport({ summary, done, importText, t }: ReportProps) {
  const types = Object.keys(typeTabs) as ResourceType[]
  const r = importText.report
  return (
    <div className="prices-import__summary">
      <h3>{done ? r.doneTitle : importText.dryRun}</h3>
      <div className="table-scroll">
        <table className="data-table prices-table">
          <caption>{importText.resourcesCaption}</caption>
          <thead>
            <tr>
              <th scope="col">{importText.type}</th>
              {outcomes.map((outcome) => (
                <th key={outcome} scope="col" className="prices-table__number">
                  {importText.outcome[outcome]}
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
        {formatMessage(importText.lists, {
          unitsNew: summary.units.new,
          unitsSame: summary.units.unchanged,
          familiesNew: summary.families.new,
          familiesSame: summary.families.unchanged,
          suppliersNew: summary.suppliers.new,
          suppliersSame: summary.suppliers.unchanged,
        })}
      </p>
      <p>
        {importText.rows}:{' '}
        {Object.entries(summary.rows)
          .map(([sheet, count]) => `${sheet} ${count}`)
          .join(' · ')}
      </p>
      <FasarReport summary={summary} importText={importText} />
      <WarningsReport summary={summary} importText={importText} />
      <ChangesReport summary={summary} importText={importText} t={t} />
      <MissingReport summary={summary} importText={importText} t={t} />
    </div>
  )
}

function FasarReport({ summary, importText }: { summary: ImportSummary; importText: ImportMessages }) {
  const r = importText.report
  const fasar = summary.fasar
  const report = fasarReport(summary)
  return (
    <section className="prices-import__block" aria-label={r.fasarTitle}>
      <h4>{r.fasarTitle}</h4>
      <p>{fasar.provided ? r.fasarProvided : importText.fasarNone}</p>
      {fasar.provided ? <p>{importText.fasarReplaces}</p> : null}
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
        <p className="prices-import__hint">{importText.fasarMismatchHint}</p>
      ) : null}
      {report?.warnings.map((warning) => (
        <Notice key={warning.code}>{formatMessage(importText.fasarWarning[warning.code], { count: warning.count })}</Notice>
      ))}
    </section>
  )
}

function WarningsReport({ summary, importText }: { summary: ImportSummary; importText: ImportMessages }) {
  const r = importText.report
  const groups = warningGroups(summary.warnings)
  return (
    <section className="prices-import__block" aria-label={r.warningsTitle}>
      <h4>{formatMessage(importText.warnings, { count: summary.warnings.total })}</h4>
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

function ChangesReport({ summary, importText, t }: { summary: ImportSummary; importText: ImportMessages; t: PricesMessages }) {
  const { money } = useCurrency()
  const r = importText.report
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
                <th scope="col">{importText.type}</th>
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

function MissingReport({ summary, importText, t }: { summary: ImportSummary; importText: ImportMessages; t: PricesMessages }) {
  const r = importText.report
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
                  <th scope="col">{importText.type}</th>
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
