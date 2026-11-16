import { useEffect, useEffectEvent, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useRemoteData } from '../../components/data/useRemoteData'
import { Notice, SkeletonRows } from '../../components/page'
import { useCurrency } from '../../currency'
import { formatMessage, intlLocales, useLocale } from '../../i18n'
import { ResourceBadges } from './ResourceBadges'
import { getResource, pricesErrorKind, type ResourceDetail } from './pricesApi'
import { costAuthor } from './pricesView'

/** Entries the detail carries; the full history is paged by `GET /resources/{id}/costs`. */
const DETAIL_HISTORY = 100

type ResourceDrawerProps = {
  organizationId: string
  resourceId: string
  onClose: () => void
}

/** Side panel with every descriptive field of a Resource, its current cost and its cost history. */
export function ResourceDrawer({ organizationId, resourceId, onClose }: ResourceDrawerProps) {
  const { messages: m } = useLocale()
  const t = m.prices
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const resource = useRemoteData(`${organizationId}:resource:${resourceId}`, () => getResource(organizationId, resourceId), {
    remember: false,
  })

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === 'Escape') onClose()
  })

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    panelRef.current?.focus()
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const detail = resource.data
  return createPortal(
    <div className="prices-drawer-overlay" onClick={onClose}>
      <div
        ref={panelRef}
        className="prices-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="prices-drawer__header">
          <div>
            <p className="prices-drawer__code data-mono">{detail?.code ?? ''}</p>
            <h2 id={titleId}>{detail?.name ?? t.detail.loading}</h2>
            {detail ? <ResourceBadges resource={detail} t={t} /> : null}
          </div>
          <button type="button" className="button button--small" onClick={onClose}>
            {t.detail.close}
          </button>
        </header>
        <div className="prices-drawer__body">
          {detail ? (
            <ResourceDetailBody detail={detail} />
          ) : resource.status === 'error' ? (
            <Notice tone="error" action={{ label: t.load.retry, onClick: resource.reload }}>
              {t.load[pricesErrorKind(resource.error)]}
            </Notice>
          ) : (
            <SkeletonRows rows={6} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function ResourceDetailBody({ detail }: { detail: ResourceDetail }) {
  const { messages: m, locale } = useLocale()
  const { money } = useCurrency()
  const t = m.prices
  const d = t.detail
  const dateTime = new Intl.DateTimeFormat(intlLocales[locale], { dateStyle: 'medium', timeStyle: 'short' })
  const day = new Intl.DateTimeFormat(intlLocales[locale], { dateStyle: 'medium', timeZone: 'UTC' })
  const none = <span className="cell-muted">{d.none}</span>

  const fields: [string, ReactNode][] = [
    [d.code, <span className="data-mono">{detail.code}</span>],
    [d.type, t.type[detail.type]],
    [d.unit, <span className="data-mono">{detail.unit.code}</span>],
    [d.family, detail.family ? `${detail.family.code} · ${detail.family.name}` : none],
    [d.supplier, detail.supplier?.name ?? none],
    [d.brand, detail.brand ?? none],
    [d.description, detail.description ?? none],
    [d.reference, detail.reference ?? none],
    [d.sapCode, detail.sapCode ?? none],
    [d.technicalSheet, detail.technicalSheet ?? none],
    [d.procedure, detail.procedure ?? none],
    [d.grouper, detail.grouper ?? none],
    [d.importedCost, detail.importedCost ? money(detail.importedCost) : none],
    [d.importedCostOn, detail.importedCostOn ? day.format(new Date(detail.importedCostOn)) : none],
    [d.source, t.source[detail.source]],
    [d.createdAt, dateTime.format(new Date(detail.createdAt))],
    [d.updatedAt, dateTime.format(new Date(detail.updatedAt))],
  ]

  return (
    <>
      <section className="prices-drawer__cost" aria-label={d.currentCost}>
        <span className="prices-drawer__label">{d.currentCost}</span>
        <strong className="data-mono">{detail.currentCost === null ? t.noCost : money(detail.currentCost)}</strong>
        {detail.costUpdatedAt ? (
          <span className="cell-muted">{formatMessage(d.costSince, { date: dateTime.format(new Date(detail.costUpdatedAt)) })}</span>
        ) : null}
      </section>

      <section aria-label={d.fields}>
        <h3>{d.fields}</h3>
        <dl className="prices-fields">
          {fields.map(([label, value]) => (
            <div key={label} className="prices-fields__row">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-label={d.historyTitle}>
        <h3>{d.historyTitle}</h3>
        {detail.history === null ? (
          <p className="cell-muted">{d.composite}</p>
        ) : detail.history.length === 0 ? (
          <p className="cell-muted">{d.historyEmpty}</p>
        ) : (
          <>
            <p className="cell-muted">{formatMessage(d.historyNote, { count: DETAIL_HISTORY })}</p>
            <div className="table-scroll">
              <table className="data-table data-table--compact">
                <thead>
                  <tr>
                    <th scope="col">{d.column.amount}</th>
                    <th scope="col">{d.column.effectiveFrom}</th>
                    <th scope="col">{d.column.source}</th>
                    <th scope="col">{d.column.recordedBy}</th>
                    <th scope="col">{d.column.supplier}</th>
                    <th scope="col">{d.column.sku}</th>
                    <th scope="col">{d.column.note}</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.history.map((cost) => (
                    <tr key={cost.id}>
                      <td className="data-mono">{money(cost.amount)}</td>
                      <td className="data-mono">{dateTime.format(new Date(cost.effectiveFrom))}</td>
                      <td>{t.source[cost.source]}</td>
                      <td>{costAuthor(cost, { import: d.importAuthor, unknown: d.none })}</td>
                      <td>{cost.supplier?.name ?? none}</td>
                      <td className={cost.sku ? 'data-mono' : undefined}>{cost.sku ?? none}</td>
                      <td>{cost.note ?? none}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </>
  )
}
