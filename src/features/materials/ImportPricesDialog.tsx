import { useId, useRef, useState, type ChangeEvent } from 'react'
import { Modal } from '../../components/modal'
import { LoadingState, Notice } from '../../components/page'
import { formatMessage, useLocale, type Locale, type Messages } from '../../i18n'
import {
  PRICE_IMPORT_TEMPLATE_NAME,
  canConfirmImport,
  importErrorText,
  invalidRowCount,
  previewDate,
  previewPrice,
  priceImportTemplateHref,
} from './priceImport'
import { localToday } from './priceRules'
import { supplierLabel } from './materialDisplay'
import {
  PriceImportRejectedError,
  importErrorKind,
  importPrices,
  type ImportErrorKind,
  type ImportReport,
} from './pricingApi'

type ImportPricesDialogProps = {
  organizationId: string
  onImported: (report: ImportReport) => void
  onClose: () => void
}

type Phase = 'idle' | 'checking' | 'importing'

/**
 * Import prices from a CSV: choosing a file runs a dry run and shows its
 * report; the real import is offered only when every row is valid. A rejected
 * import (422) shows the rows again.
 */
export function ImportPricesDialog({ organizationId, onImported, onClose }: ImportPricesDialogProps) {
  const { messages: m, locale } = useLocale()
  const t = m.materials
  const ti = t.import
  const fileId = useId()
  const [file, setFile] = useState<File | null>(null)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [errorKind, setErrorKind] = useState<ImportErrorKind | null>(null)
  /** Only the newest file's dry run may update the dialog. */
  const latestCheck = useRef(0)

  async function check(chosen: File) {
    const token = ++latestCheck.current
    setFile(chosen)
    setReport(null)
    setErrorKind(null)
    setPhase('checking')
    try {
      const result = await importPrices(organizationId, chosen, { dryRun: true })
      if (token === latestCheck.current) setReport(result)
    } catch (error) {
      if (token === latestCheck.current) setErrorKind(importErrorKind(error))
    } finally {
      if (token === latestCheck.current) setPhase('idle')
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0]
    // Clear the input so choosing the same file again, after fixing it, runs a new check.
    event.target.value = ''
    if (chosen) void check(chosen)
  }

  async function confirm() {
    if (!file || !canConfirmImport(report, phase !== 'idle')) return
    setErrorKind(null)
    setPhase('importing')
    try {
      onImported(await importPrices(organizationId, file, { dryRun: false }))
    } catch (error) {
      if (error instanceof PriceImportRejectedError) setReport(error.report)
      setErrorKind(importErrorKind(error))
      setPhase('idle')
    }
  }

  const count = report?.summary.observations ?? 0
  const confirmLabel = count === 1 ? ti.confirmOne : formatMessage(ti.confirm, { count })

  return (
    <Modal title={ti.title} description={ti.description} onClose={onClose}>
      <div className="price-import">
        <p className="price-import__hint">{ti.columnsHint}</p>
        <p>
          <a className="table-link" href={priceImportTemplateHref(localToday())} download={PRICE_IMPORT_TEMPLATE_NAME}>
            {ti.template}
          </a>
        </p>
        <div className="price-import__file">
          <label htmlFor={fileId}>{ti.fileLabel}</label>
          <input
            id={fileId}
            type="file"
            accept=".csv,text/csv"
            disabled={phase === 'importing'}
            onChange={onFileChange}
          />
        </div>

        {errorKind ? (
          <Notice tone="error">
            {errorKind === 'badFile' || errorKind === 'importRejected' ? ti.error[errorKind] : t.error[errorKind]}
          </Notice>
        ) : null}

        {phase === 'checking' ? <LoadingState label={ti.checking} /> : null}
        {report && phase !== 'checking' ? <ImportPreview report={report} t={ti} locale={locale} /> : null}
      </div>

      <div className="button-row button-row--end modal-actions">
        <button type="button" className="button" onClick={onClose}>
          {ti.cancel}
        </button>
        {report ? (
          <button
            type="button"
            className="button button--primary"
            disabled={!canConfirmImport(report, phase !== 'idle')}
            onClick={() => void confirm()}
          >
            {phase === 'importing' ? ti.importing : confirmLabel}
          </button>
        ) : null}
      </div>
    </Modal>
  )
}

type ImportMessages = Messages['materials']['import']

function ImportPreview({ report, t, locale }: { report: ImportReport; t: ImportMessages; locale: Locale }) {
  const { summary } = report
  if (report.rows.length === 0) return <Notice>{t.empty}</Notice>

  const invalid = invalidRowCount(report)
  return (
    <>
      <p className="price-import__summary" role="status">
        {invalid > 0 ? formatMessage(t.invalidSummary, { count: invalid, rows: summary.rows }) : formatMessage(t.summary, summary)}
      </p>
      <div className="table-scroll">
        <table className="data-table price-import__table" aria-label={t.previewLabel}>
          <thead>
            <tr>
              <th scope="col">{t.column.line}</th>
              <th scope="col">{t.column.material}</th>
              <th scope="col">{t.column.supplier}</th>
              <th scope="col">{t.column.price}</th>
              <th scope="col">{t.column.observedOn}</th>
              <th scope="col">{t.column.status}</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr key={row.line} data-invalid={row.errors.length > 0 || undefined}>
                <td className="data-mono">{row.line}</td>
                <td>{row.material || '—'}</td>
                <td>{row.supplier ? supplierLabel({ name: row.supplier, branch: row.branch ?? null }) : '—'}</td>
                <td className="data-mono">{previewPrice(row.price, locale)}</td>
                <td>{previewDate(row.observedOn, locale)}</td>
                <td>
                  {row.errors.length > 0 ? (
                    <ul className="price-import__errors">
                      {row.errors.map((error) => (
                        <li key={`${error.field}:${error.code}`}>{importErrorText(error, t)}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="price-import__tags">
                      {row.newMaterial ? (
                        <span className="badge" data-tone="accent">
                          {t.newMaterial}
                        </span>
                      ) : null}
                      {row.newSupplier ? (
                        <span className="badge" data-tone="accent">
                          {t.newSupplier}
                        </span>
                      ) : null}
                      {!row.newMaterial && !row.newSupplier ? (
                        <span className="badge" data-tone="success">
                          {t.ready}
                        </span>
                      ) : null}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
