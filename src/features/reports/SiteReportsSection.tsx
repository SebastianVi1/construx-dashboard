import { useEffect, useState } from 'react'
import { useRemoteData } from '../../components/data/useRemoteData'
import { SkeletonTable, Notice } from '../../components/page'
import { intlLocales, useLocale } from '../../i18n'
import { downloadPresigned } from '../../lib/http'
import { formatDate } from '../home/format'
import { getDownloadUrl, listReports, type SiteReport } from './reportApi'
import { cacheReports, getPdfBlob, savePdfBlob } from './reportStorage'
import { GenerateReportDialog } from './GenerateReportDialog'
import '../documents/documents.css'

type Props = {
  organizationId: string
  siteId: string
  canGenerate: boolean
}

export function SiteReportsSection({ organizationId, siteId, canGenerate }: Props) {
  const { messages: m, locale } = useLocale()
  const t = m.reports
  const key = `${organizationId}:${siteId}:reports`
  const remote = useRemoteData(key, () =>
    listReports(organizationId, siteId).then((reports) => {
      cacheReports(siteId, reports)
      return reports
    }),
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [opening, setOpening] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ title: string; url: string } | null>(null)

  useEffect(() => {
    if (!preview) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPreview(null)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      URL.revokeObjectURL(preview.url)
    }
  }, [preview])

  function onGenerated(report: SiteReport) {
    remote.update((current) => [report, ...(current ?? [])])
    setDialogOpen(false)
  }

  async function loadPdf(report: SiteReport): Promise<Blob> {
    // Try cached blob first
    const cached = await getPdfBlob(report.id)
    if (cached) return cached
    const url = await getDownloadUrl(organizationId, siteId, report.id)
    const blob = await downloadPresigned(url)
    savePdfBlob(report.id, blob)
    return blob
  }

  async function openPreview(report: SiteReport) {
    if (opening) return
    setDownloadError(null)
    setOpening(report.id)
    try {
      const blob = await loadPdf(report)
      const pdf = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' })
      setPreview({ title: report.title, url: URL.createObjectURL(pdf) })
    } catch {
      setDownloadError(t.error.preview)
    } finally {
      setOpening(null)
    }
  }

  async function download(report: SiteReport) {
    if (downloading) return
    setDownloadError(null)
    setDownloading(report.id)
    try {
      const blob = await loadPdf(report)
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${report.title}.pdf`
      link.click()
      setTimeout(() => URL.revokeObjectURL(link.href), 30_000)
    } catch {
      setDownloadError(t.error.download)
    } finally {
      setDownloading(null)
    }
  }

  return (
    <section className="page-section" aria-labelledby="site-reports-heading">
      <div className="page-section__header">
        <h2 id="site-reports-heading">{t.title}</h2>
        {canGenerate ? (
          <button type="button" className="button" onClick={() => setDialogOpen(true)}>
            {t.generate}
          </button>
        ) : null}
      </div>

      {downloadError ? <Notice tone="error">{downloadError}</Notice> : null}

      {remote.status === 'loading' && !remote.data ? (
        <SkeletonTable columns={4} />
      ) : remote.status === 'error' ? (
        <Notice tone="error" action={{ label: m.sites.load.retry, onClick: remote.reload }}>
          {t.loadError}
        </Notice>
      ) : remote.data && remote.data.length > 0 ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t.column.title}</th>
                <th>{t.column.date}</th>
                <th>{t.column.generatedBy}</th>
                <th>{t.column.actions}</th>
              </tr>
            </thead>
            <tbody>
              {remote.data.map((report) => (
                <tr key={report.id}>
                  <td>{report.title}</td>
                  <td className="data-mono">{formatDate(report.createdAt, intlLocales[locale])}</td>
                  <td>{report.generatedByName ?? '—'}</td>
                  <td>
                    {report.status === 'READY' ? (
                      <div className="button-row">
                        <button
                          type="button"
                          className="button button--ghost button--sm"
                          onClick={() => openPreview(report)}
                          disabled={opening === report.id}
                          aria-busy={opening === report.id}
                        >
                          {opening === report.id ? t.opening : t.preview}
                        </button>
                        <button
                          type="button"
                          className="button button--ghost button--sm"
                          onClick={() => download(report)}
                          disabled={downloading === report.id}
                          aria-busy={downloading === report.id}
                        >
                          {downloading === report.id ? t.downloading : t.download}
                        </button>
                      </div>
                    ) : report.status === 'FAILED' ? (
                      <span className="text-muted">{t.status.FAILED}</span>
                    ) : (
                      <span className="text-muted">{t.status.PENDING}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty-state">{t.empty}</p>
      )}

      {preview ? (
        <div
          className="document-preview-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={preview.title}
          onClick={() => setPreview(null)}
        >
          <button
            className="document-preview-overlay__close button button--ghost"
            type="button"
            aria-label={t.closePreview}
            onClick={() => setPreview(null)}
          >
            ✕
          </button>
          <iframe
            className="document-preview-overlay__pdf"
            src={preview.url}
            title={preview.title}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}

      {dialogOpen ? (
        <GenerateReportDialog
          organizationId={organizationId}
          siteId={siteId}
          onGenerated={onGenerated}
          onClose={() => setDialogOpen(false)}
        />
      ) : null}
    </section>
  )
}
