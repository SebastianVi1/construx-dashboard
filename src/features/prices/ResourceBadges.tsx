import type { Messages } from '../../i18n'
import type { FasarStatus, Resource } from './pricesApi'

/** Archived, discontinued and "not in the last import" markers of a Resource; nothing when none applies. */
export function ResourceBadges({ resource, t }: { resource: Resource; t: Messages['prices'] }) {
  if (!resource.archivedAt && !resource.discontinued && !resource.missingFromImportAt) return null
  return (
    <span className="prices-badges">
      {resource.archivedAt ? <span className="badge">{t.archived}</span> : null}
      {resource.discontinued ? (
        <span className="badge" data-tone="warning">
          {t.discontinuedBadge}
        </span>
      ) : null}
      {resource.missingFromImportAt ? (
        <span className="badge" data-tone="danger">
          {t.missingBadge}
        </span>
      ) : null}
    </span>
  )
}

/** The FASAR status, on the FASAR screen and the catalog header. */
export function FasarStatusBadge({ status, t }: { status: FasarStatus; t: Messages['prices']['fasar'] }) {
  const tone = status === 'COMPLETE' ? 'success' : status === 'PARTIAL' ? 'warning' : undefined
  return (
    <span className="badge" data-tone={tone} title={t.statusHint[status]}>
      {t.status[status]}
    </span>
  )
}
