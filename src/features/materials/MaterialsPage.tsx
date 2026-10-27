import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useRemoteData } from '../../components/data/useRemoteData'
import { FilterTabs, filterCounts, type FilterOption } from '../../components/filter'
import { LoadingState, Notice } from '../../components/page'
import { formatMessage, useLocale, type Locale, type Messages } from '../../i18n'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { usePermissions } from '../permissions'
import { CreateMaterialDialog } from './CreateMaterialDialog'
import { LatestPrices } from './MaterialBits'
import { loadKind } from './materialDisplay'
import { RecordPriceDialog } from './RecordPriceDialog'
import { localToday, matchesQuery } from './priceRules'
import { listMaterials, materialCategories, pricingErrorKind, type Material, type MaterialCategory } from './pricingApi'
import './materials.css'

/**
 * Material prices of the company. The active catalog loads once; search (name
 * and brand) and the category tabs filter it here.
 */
export function MaterialsPage() {
  const { messages: m, locale } = useLocale()
  const t = m.materials
  const organization = useCurrentOrganization()
  const { can } = usePermissions()
  const canView = can('VIEW_PRICES')
  const canManage = can('MANAGE_PRICES')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<MaterialCategory | ''>('')
  const [dialog, setDialog] = useState<'material' | 'price' | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const materials = useRemoteData(canView ? `${organization.id}:materials` : null, () => listMaterials(organization.id))

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

  const all = materials.data
  const searched = all?.filter((material) => matchesQuery(material, search)) ?? []
  const { counts, visible } = filterCounts(searched, (material) => material.category, materialCategories, category)
  const filters: FilterOption<MaterialCategory | ''>[] = [
    { value: '', label: t.filterAll, count: all ? counts.all : undefined },
    ...materialCategories.map((value) => ({ value, label: t.category[value], count: all ? counts[value] : undefined })),
  ]
  const today = localToday()

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__text">
          <h1>{t.title}</h1>
          <p>{t.description}</p>
        </div>
        {canManage ? (
          <div className="button-row">
            <button type="button" className="button" onClick={() => setDialog('material')}>
              {t.add}
            </button>
            {all && all.length > 0 ? (
              <button type="button" className="button button--primary" onClick={() => setDialog('price')}>
                {t.recordPrice}
              </button>
            ) : null}
          </div>
        ) : null}
      </header>

      {notice ? <Notice tone="success">{notice}</Notice> : null}

      <section className="page-section" aria-label={t.title}>
        {all && all.length > 0 ? (
          <>
            <div className="materials-toolbar">
              <input
                type="search"
                className="materials-search"
                aria-label={t.searchLabel}
                placeholder={t.searchPlaceholder}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <FilterTabs label={t.filterLabel} options={filters} value={category} onChange={setCategory} />
            {visible.length > 0 ? (
              <MaterialsTable materials={visible} today={today} t={t} locale={locale} />
            ) : (
              <div className="empty-state">
                <p>{t.noResults}</p>
              </div>
            )}
          </>
        ) : all ? (
          <div className="empty-state">
            <h2>{t.emptyTitle}</h2>
            <p>{t.empty}</p>
            {canManage ? (
              <button type="button" className="button button--primary" onClick={() => setDialog('material')}>
                {t.addFirst}
              </button>
            ) : null}
          </div>
        ) : materials.status === 'error' ? (
          <Notice tone="error" action={{ label: t.load.retry, onClick: materials.reload }}>
            {t.load[loadKind(pricingErrorKind(materials.error))]}
          </Notice>
        ) : (
          <LoadingState label={t.loading} />
        )}
      </section>

      {dialog === 'material' ? <CreateMaterialDialog organizationId={organization.id} onClose={() => setDialog(null)} /> : null}
      {dialog === 'price' && all ? (
        <RecordPriceDialog
          organizationId={organization.id}
          materials={all}
          onRecorded={() => {
            setDialog(null)
            setNotice(t.detail.recorded)
            materials.reload()
          }}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  )
}

function MaterialsTable({ materials, today, t, locale }: { materials: Material[]; today: string; t: Messages['materials']; locale: Locale }) {
  return (
    <div className="table-scroll">
      <table className="data-table materials-table">
        <thead>
          <tr>
            <th scope="col">{t.column.material}</th>
            <th scope="col">{t.column.unit}</th>
            <th scope="col">{t.column.prices}</th>
          </tr>
        </thead>
        <tbody>
          {materials.map((material) => (
            <tr key={material.id}>
              <td>
                <Link className="table-link" to={`/materials/${encodeURIComponent(material.id)}`}>
                  {material.name}
                </Link>
                <span className="materials-table__meta">
                  {material.brand || t.noBrand} · {t.category[material.category]}
                </span>
              </td>
              <td>{formatMessage(t.perUnit, { unit: t.unit[material.unit] })}</td>
              <td>
                <LatestPrices prices={material.latestPrices} today={today} t={t} locale={locale} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

