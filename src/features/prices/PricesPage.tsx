import { useEffect } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { useRemoteData } from '../../components/data/useRemoteData'
import { Notice } from '../../components/page'
import { useCurrency } from '../../currency'
import { formatMessage, useLocale } from '../../i18n'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { usePermissions } from '../permissions'
import { CatalogSummaryLine } from './CatalogSummaryLine'
import { PricesTabs } from './PricesTabs'
import { getCatalog } from './pricesApi'
import { ResourceDrawer } from './ResourceDrawer'
import { ResourcesPanel } from './ResourcesPanel'
import { panelId, parsePricesSearch, pricesSearchString, resourceRoute, tabId, type PricesView } from './resourceQuery'
import './prices.css'

/**
 * The company's cost catalog. The tab, filters, sort and page live in the URL
 * (`/prices?tab=equipment&q=…`), and `/prices/:resourceId` opens a Resource's
 * detail in a drawer over the same list.
 */
export function PricesPage() {
  const { messages: m } = useLocale()
  const t = m.prices
  const { currency } = useCurrency()
  const organization = useCurrentOrganization()
  const { can } = usePermissions()
  const canView = can('VIEW_PRICES')
  const { resourceId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const view = parsePricesSearch(new URLSearchParams(location.search))
  const catalog = useRemoteData(canView ? `${organization.id}:catalog` : null, () => getCatalog(organization.id))

  useEffect(() => {
    document.title = `${t.title} | Construx`
  }, [t.title])

  if (!canView) {
    return (
      <div className="page">
        <Notice>{m.workspace.forbidden}</Notice>
      </div>
    )
  }

  const search = pricesSearchString(view)

  // Typing in the search replaces the entry; tabs, pages and filters can be stepped back through.
  function changeView(next: PricesView, { replace = false } = {}) {
    navigate({ pathname: resourceId ? resourceRoute(resourceId) : '/prices', search: pricesSearchString(next) }, { replace })
  }

  return (
    <div className="page page--wide prices-page">
      <header className="page-header">
        <div className="page-header__text">
          <h1>{t.title}</h1>
          <p>{formatMessage(t.description, { currency })}</p>
        </div>
        {catalog.data?.exists ? <CatalogSummaryLine catalog={catalog.data} /> : null}
      </header>

      <PricesTabs
        value={view.tab}
        counts={catalog.data?.counts}
        onChange={(tab) => changeView({ ...view, tab, page: 0 })}
      />

      <div role="tabpanel" id={panelId(view.tab)} aria-labelledby={tabId(view.tab)} className="prices-panel">
        {catalog.data && !catalog.data.exists ? (
          <div className="empty-state">
            <h2>{t.summary.noCatalogTitle}</h2>
            <p>{t.summary.noCatalog}</p>
          </div>
        ) : (
          <ResourcesPanel
            organizationId={organization.id}
            view={view}
            onChange={changeView}
            onOpen={(id) => navigate({ pathname: resourceRoute(id), search })}
          />
        )}
      </div>

      {resourceId ? (
        <ResourceDrawer
          organizationId={organization.id}
          resourceId={resourceId}
          onClose={() => navigate({ pathname: '/prices', search })}
        />
      ) : null}
    </div>
  )
}
