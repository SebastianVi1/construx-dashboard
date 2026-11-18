import { formatMessage, intlLocales, useLocale } from '../../i18n'

type ResourcesPagerProps = {
  /** Zero-based, as the API. */
  page: number
  size: number
  totalElements: number
  totalPages: number
  onPage: (page: number) => void
}

/** "51–100 of 24,375" with previous and next; nothing to page through on a single page. */
export function ResourcesPager({ page, size, totalElements, totalPages, onPage }: ResourcesPagerProps) {
  const { messages: m, locale } = useLocale()
  const t = m.prices.pager
  const number = new Intl.NumberFormat(intlLocales[locale])
  const from = totalElements === 0 ? 0 : page * size + 1
  const to = Math.min(totalElements, (page + 1) * size)

  return (
    <nav className="prices-pager" aria-label={t.label}>
      <p className="prices-pager__range data-mono">
        {formatMessage(t.range, { from: number.format(from), to: number.format(to), total: number.format(totalElements) })}
      </p>
      {totalPages > 1 ? (
        <div className="prices-pager__steps">
          <span className="prices-pager__page">
            {formatMessage(t.page, { page: number.format(page + 1), pages: number.format(totalPages) })}
          </span>
          <button type="button" className="button button--small" disabled={page === 0} onClick={() => onPage(page - 1)}>
            {t.previous}
          </button>
          <button type="button" className="button button--small" disabled={page + 1 >= totalPages} onClick={() => onPage(page + 1)}>
            {t.next}
          </button>
        </div>
      ) : null}
    </nav>
  )
}
