import { formatMessage, intlLocales, useLocale } from '../../i18n'
import type { CatalogSummary } from './pricesApi'
import { formatInstant } from './resourceDisplay'

/** Freshness of the catalog beside the page title: the last import and what it no longer had. */
export function CatalogSummaryLine({ catalog }: { catalog: CatalogSummary }) {
  const { messages: m, locale } = useLocale()
  const t = m.prices.summary
  const { lastImport, missingFromImport } = catalog
  const finished = lastImport?.finishedAt

  return (
    <div className="prices-summary">
      <p className="prices-summary__import">
        {finished ? formatMessage(t.lastImport, { date: formatInstant(finished, locale) }) : t.noImport}
      </p>
      {missingFromImport > 0 ? (
        <span className="badge" data-tone="warning">
          {formatMessage(t.missing, { count: new Intl.NumberFormat(intlLocales[locale]).format(missingFromImport) })}
        </span>
      ) : null}
    </div>
  )
}
