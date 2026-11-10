import { useId, useState, type FormEvent } from 'react'
import { Modal } from '../../components/modal'
import { useLocale } from '../../i18n'
import { generateReport, type SiteReport } from './reportApi'
import { cacheReport, savePdfBlob } from './reportStorage'
import { Field, TEXT_LIMITS } from '../../components/form'

type Props = {
  organizationId: string
  siteId: string
  onGenerated: (report: SiteReport) => void
  onClose: () => void
}

export function GenerateReportDialog({ organizationId, siteId, onGenerated, onClose }: Props) {
  const { messages: m } = useLocale()
  const t = m.reports
  const titleId = useId()
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const titleIssue = title.trim().length === 0
    ? t.validation.titleRequired
    : title.trim().length > TEXT_LIMITS.reportTitle
      ? t.validation.titleMax
      : null

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (titleIssue || busy) return
    setBusy(true)
    setError(null)
    try {
      const report = await generateReport(organizationId, siteId, title.trim())
      await cacheReport(siteId, report)
      if (report.pdfBase64) {
        const bytes = Uint8Array.from(atob(report.pdfBase64), c => c.charCodeAt(0))
        savePdfBlob(report.id, new Blob([bytes], { type: 'application/pdf' }))
      }
      onGenerated(report)
    } catch {
      setError(t.error.generate)
      setBusy(false)
    }
  }

  return (
    <Modal title={t.dialog.title} description={t.dialog.description} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <Field
          config={{
            name: `${titleId}-title`,
            label: t.dialog.label,
            placeholder: t.dialog.placeholder,
            autoComplete: 'off',
            maxLength: TEXT_LIMITS.reportTitle,
          }}
          value={title}
          error={titleIssue && title.length > 0 ? titleIssue : undefined}
          valid={!titleIssue}
          disabled={busy}
          onChange={setTitle}
        />
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="button-row button-row--end modal-actions">
          <button type="button" className="button button--ghost" onClick={onClose} disabled={busy}>
            {t.dialog.cancel}
          </button>
          <button type="submit" className="button button--primary" disabled={busy || title.trim().length === 0} aria-busy={busy}>
            {busy ? t.dialog.generating : t.dialog.submit}
          </button>
        </div>
      </form>
    </Modal>
  )
}
