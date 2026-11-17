import type { KeyboardEvent } from 'react'
import { formatMessage, intlLocales, useLocale } from '../../i18n'
import type { CatalogSummary } from './pricesApi'
import { isTabActive, pricesTabs, tabResourceType, type PricesTab } from './resourceQuery'

type PricesTabsProps = {
  value: PricesTab
  /** Catalog counts; the active tabs show theirs once loaded. */
  counts: CatalogSummary['counts'] | undefined
  onChange: (tab: PricesTab) => void
}

const openTabs = pricesTabs.filter(isTabActive)

/** The catalog sections. Sections of later releases stay visible, disabled, with "Coming soon". */
export function PricesTabs({ value, counts, onChange }: PricesTabsProps) {
  const { messages: m, locale } = useLocale()
  const t = m.prices
  const number = new Intl.NumberFormat(intlLocales[locale])

  function countOf(tab: PricesTab): number | undefined {
    const type = tabResourceType(tab)
    if (!counts) return undefined
    return type ? counts[type] : tab === 'suppliers' ? counts.suppliers : undefined
  }

  // Arrow keys move between the sections that can be opened, as in any tab list.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const step = event.key === 'ArrowRight' ? 1 : -1
    const next = openTabs[(openTabs.indexOf(value) + step + openTabs.length) % openTabs.length]
    onChange(next)
    document.getElementById(`prices-tab-${next}`)?.focus()
  }

  return (
    <div className="prices-tabs" role="tablist" aria-label={t.tabsLabel} onKeyDown={onKeyDown}>
      {pricesTabs.map((tab) => {
        const active = isTabActive(tab)
        const selected = tab === value
        const count = active ? countOf(tab) : undefined
        return (
          <button
            key={tab}
            id={`prices-tab-${tab}`}
            type="button"
            role="tab"
            className="prices-tabs__tab"
            aria-selected={selected}
            aria-controls={selected ? `prices-panel-${tab}` : undefined}
            aria-disabled={active ? undefined : true}
            tabIndex={selected ? 0 : -1}
            title={active ? undefined : formatMessage(t.comingSoonHint, { tab: t.tab[tab] })}
            onClick={() => {
              if (active && !selected) onChange(tab)
            }}
          >
            <span className="prices-tabs__label">{t.tab[tab]}</span>
            {active ? (
              count === undefined ? null : <span className="prices-tabs__count">{number.format(count)}</span>
            ) : (
              <span className="prices-tabs__soon">{t.comingSoon}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
