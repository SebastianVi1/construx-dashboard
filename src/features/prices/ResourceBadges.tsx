import { useLocale } from '../../i18n'
import type { Resource } from './pricesApi'

type BadgeFields = Pick<Resource, 'archivedAt' | 'discontinued' | 'missingFromImportAt'>

/** States that change how far a Resource can be trusted or used; nothing when it is a plain active entry. */
export function ResourceBadges({ resource }: { resource: BadgeFields }) {
  const { messages: m } = useLocale()
  const t = m.prices.badge
  if (!resource.archivedAt && !resource.discontinued && !resource.missingFromImportAt) return null

  return (
    <span className="prices-badges">
      {resource.missingFromImportAt ? (
        <span className="badge" data-tone="danger">
          {t.missing}
        </span>
      ) : null}
      {resource.discontinued ? (
        <span className="badge" data-tone="warning">
          {t.discontinued}
        </span>
      ) : null}
      {resource.archivedAt ? (
        <span className="badge" data-tone="muted">
          {t.archived}
        </span>
      ) : null}
    </span>
  )
}
