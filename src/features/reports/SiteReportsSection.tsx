import { useState } from 'react'
import { useRemoteData } from '../../components/data/useRemoteData'
import { SkeletonList, Notice } from '../../components/page'
import { intlLocales, useLocale } from '../../i18n'
import { downloadPresigned } from '../../lib/http'
import { formatDate } from '../home/format'
import { getDownloadUrl, listReports, type SiteReport } from './reportApi'
import { cacheReports, getPdfBlob, savePdfBlob } from './reportStorage'
import { GenerateReportDialog } from './GenerateReportDialog'

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

  function onGenerated(report: SiteReport) {
    remote.update((current) => [report, ...(current ?? [])])
    setDialogOpen(false)
  }

  async function download(report: SiteReport) {
    if (downloading) return
    setDownloadError(null)
    setDownloading(report.id)
    try {
      // Try cached blob first
      let blob = await getPdfBlob(report.id)
      if (!blob) {
        const url = await getDownloadUrl(organizationId, siteId, report.id)
        blob = await downloadPresigned(url)
        savePdfBlob(report.id, blob)
      }
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

      {remote.status === 'loading' ? (
        <SkeletonList />
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
                      <button
                        type="button"
                        className="button button--ghost button--sm"
                        onClick={() => download(report)}
                        disabled={downloading === report.id}
                      >
                        {downloading === report.id ? t.downloading : t.download}
                      </button>
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
