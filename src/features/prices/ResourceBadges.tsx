import type { Messages } from '../../i18n'
import type { Resource } from './pricesApi'

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
