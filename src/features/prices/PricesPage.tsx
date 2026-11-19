import { useEffect } from 'react'
import { Field } from '../../components/form'
import { Notice } from '../../components/page'
import { useLocale } from '../../i18n'
import { usePermissions } from '../permissions'
import './prices.css'

const tabs = ['materials', 'labor', 'equipment', 'workItems', 'suppliers', 'import'] as const
const noChange = () => {}

export function PricesPage() {
  const { messages: m } = useLocale()
  const t = m.prices
  const { can } = usePermissions()

  useEffect(() => {
    document.title = `${t.title} | Construx`
  }, [t.title])

  if (!can('VIEW_PRICES')) {
    return <div className="page"><Notice>{m.workspace.forbidden}</Notice></div>
  }

  return (
    <div className="page page--wide prices-page">
      <header className="page-header">
        <div className="page-header__text">
          <h1>{t.title}</h1>
          <p>{t.description}</p>
        </div>
      </header>

      <div className="prices-tabs" role="tablist" aria-label={t.tabsLabel}>
        {tabs.map((tab) => (
          <button
            key={tab}
            id={`prices-tab-${tab}`}
            type="button"
            role="tab"
            className="prices-tabs__tab"
            aria-selected={tab === 'materials'}
            aria-controls={tab === 'materials' ? 'prices-panel-materials' : undefined}
            aria-disabled="true"
            disabled
          >
            <span className="prices-tabs__label">{t.tab[tab]}</span>
          </button>
        ))}
      </div>

      <div role="tabpanel" id="prices-panel-materials" aria-labelledby="prices-tab-materials" className="prices-panel">
        <section className="page-section prices-resources" aria-label={t.tab.materials}>
          <div className="prices-filters" role="search" aria-label={t.filters.label}>
            <div className="prices-filters__search">
              <Field config={{ name: 'prices-search', label: t.filters.search, type: 'search', placeholder: t.filters.searchPlaceholder }} value="" disabled onChange={noChange} />
            </div>
            <Field config={{ name: 'prices-family', label: t.filters.family, type: 'select', options: [{ value: '', label: t.filters.any }] }} value="" disabled onChange={noChange} />
            <Field config={{ name: 'prices-unit', label: t.filters.unit, type: 'select', options: [{ value: '', label: t.filters.any }] }} value="" disabled onChange={noChange} />
            <Field config={{ name: 'prices-supplier', label: t.filters.supplier, type: 'select', options: [{ value: '', label: t.filters.any }] }} value="" disabled onChange={noChange} />
            <Field config={{ name: 'prices-discontinued', label: t.filters.discontinued, type: 'select', options: [{ value: 'all', label: t.filters.showAll }] }} value="all" disabled onChange={noChange} />
            <div className="prices-filters__end">
              <Field config={{ name: 'prices-archived', label: t.filters.archived, type: 'checkboxes', options: [{ value: 'archived', label: t.filters.includeArchived }], groupClassName: 'prices-filters__check', groupLabelClassName: 'visually-hidden', optionClassName: 'prices-filters__check-option' }} value="[]" disabled onChange={noChange} />
              <button type="button" className="button button--small prices-filters__clear" disabled>{t.filters.clear}</button>
            </div>
          </div>

          <div className="table-scroll prices-table-wrap">
            <table className="data-table prices-table">
              <thead>
                <tr>
                  <th scope="col">{t.column.code}</th>
                  <th scope="col">{t.column.name}</th>
                  <th scope="col">{t.column.unit}</th>
                  <th scope="col">{t.column.family}</th>
                  <th scope="col">{t.column.supplier}</th>
                  <th scope="col" className="prices-table__numeric">{t.column.currentCost}</th>
                  <th scope="col">{t.column.costUpdatedAt}</th>
                </tr>
              </thead>
              <tbody>
                <tr><td colSpan={7} className="prices-table__placeholder">{t.placeholder}</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
