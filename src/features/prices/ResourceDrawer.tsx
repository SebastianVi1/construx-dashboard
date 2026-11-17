import { useEffect, useEffectEvent, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useRemoteData } from '../../components/data/useRemoteData'
import { ConfirmDialog } from '../../components/modal'
import { Notice, SkeletonRows } from '../../components/page'
import { useCurrency } from '../../currency'
import { formatMessage, intlLocales, useLocale } from '../../i18n'
import { LaborWageDialog } from './LaborWageDialog'
import { ResourceBadges } from './ResourceBadges'
import { ResourceComposition } from './ResourceComposition'
import { RecordCostDialog } from './RecordCostDialog'
import { ResourceFormDialog } from './ResourceFormDialog'
import { archiveResource, getResource, pricesErrorKind, type ResourceDetail } from './pricesApi'
import { costAuthor, resourceActions } from './pricesView'
import { resourceWriteErrorKind } from './resourceForm'

/** Entries the detail carries; the full history is paged by `GET /resources/{id}/costs`. */
const DETAIL_HISTORY = 100

type ResourceDrawerProps = {
  organizationId: string
  resourceId: string
  /** Show the edit, archive and record-cost actions (MANAGE_PRICES). */
  canManage: boolean
  /** After a write, so the list behind the drawer shows it. */
  onChanged: () => void
  onClose: () => void
}

type DrawerDialog = 'edit' | 'cost' | 'wage' | 'archive' | null

/**
 * Side panel with every descriptive field of a Resource, its current cost, its composition (analysis, wage,
 * machinery, where it is used) and its cost history. Opening a component or a parent stacks it in the same
 * panel; "back" returns to the previous one.
 */
export function ResourceDrawer({ organizationId, resourceId: initialId, canManage, onChanged, onClose }: ResourceDrawerProps) {
  const [trail, setTrail] = useState<{ id: string; code: string }[]>([])
  const [resourceId, setResourceId] = useState(initialId)
  const { messages: m } = useLocale()
  const t = m.prices
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const resource = useRemoteData(`${organizationId}:resource:${resourceId}`, () => getResource(organizationId, resourceId), {
    remember: false,
  })

  const [dialog, setDialog] = useState<DrawerDialog>(null)
  const [archiveError, setArchiveError] = useState<string | null>(null)

  // A dialog on top handles its own Escape; only close the drawer when none is open.
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === 'Escape' && dialog === null) onClose()
  })

  function open(nextId: string) {
    if (nextId === resourceId || !resource.data) return
    setTrail([...trail, { id: resourceId, code: resource.data.code }])
    setResourceId(nextId)
    setDialog(null)
  }

  function back() {
    const previous = trail[trail.length - 1]
    if (!previous) return
    setTrail(trail.slice(0, -1))
    setResourceId(previous.id)
    setDialog(null)
  }

  function saved(next: ResourceDetail) {
    resource.update(() => next)
    setDialog(null)
    onChanged()
  }

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    panelRef.current?.focus()
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const detail = resource.data
  const actions = detail && canManage ? resourceActions(detail) : null
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
            {trail.length > 0 ? (
              <button type="button" className="table-link prices-drawer__back" onClick={back}>
                ← {formatMessage(t.composition.back, { code: trail[trail.length - 1].code })}
              </button>
            ) : null}
            <p className="prices-drawer__code data-mono">{detail?.code ?? ''}</p>
            <h2 id={titleId}>{detail?.name ?? t.detail.loading}</h2>
            {detail ? <ResourceBadges resource={detail} t={t} /> : null}
          </div>
          <button type="button" className="button button--small" onClick={onClose}>
            {t.detail.close}
          </button>
        </header>
        {actions && (actions.edit || actions.recordCost || actions.editWage || actions.archive) ? (
          <div className="prices-drawer__actions">
            {actions.editWage ? (
              <button type="button" className="button button--primary button--small" onClick={() => setDialog('wage')}>
                {t.write.editWage}
              </button>
            ) : null}
            {actions.recordCost ? (
              <button type="button" className="button button--primary button--small" onClick={() => setDialog('cost')}>
                {t.write.recordCost}
              </button>
            ) : null}
            {actions.edit ? (
              <button type="button" className="button button--small" onClick={() => setDialog('edit')}>
                {t.write.edit}
              </button>
            ) : null}
            {actions.archive ? (
              <button
                type="button"
                className="button button--small"
                onClick={() => {
                  setArchiveError(null)
                  setDialog('archive')
                }}
              >
                {t.write.archive}
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="prices-drawer__body">
          {detail ? (
            <ResourceDetailBody organizationId={organizationId} detail={detail} onOpen={open} />
          ) : resource.status === 'error' ? (
            <Notice tone="error" action={{ label: t.load.retry, onClick: resource.reload }}>
              {t.load[pricesErrorKind(resource.error)]}
            </Notice>
          ) : (
            <SkeletonRows rows={6} />
          )}
        </div>
        {detail && dialog === 'edit' ? (
          <ResourceFormDialog
            organizationId={organizationId}
            type={detail.type === 'EQUIPMENT' ? 'EQUIPMENT' : 'MATERIAL'}
            resource={detail}
            onSaved={saved}
            onClose={() => setDialog(null)}
          />
        ) : null}
        {detail && dialog === 'wage' ? (
          <LaborWageDialog organizationId={organizationId} resource={detail} onSaved={saved} onClose={() => setDialog(null)} />
        ) : null}
        {detail && dialog === 'cost' ? (
          <RecordCostDialog organizationId={organizationId} resource={detail} onRecorded={saved} onClose={() => setDialog(null)} />
        ) : null}
        {detail && dialog === 'archive' ? (
          <ConfirmDialog
            title={formatMessage(t.write.archiveTitle, { code: detail.code })}
            body={t.write.archiveBody}
            confirmLabel={t.write.archive}
            pendingLabel={t.write.archiving}
            cancelLabel={t.write.cancel}
            error={archiveError}
            onConfirm={async () => {
              try {
                saved(await archiveResource(organizationId, detail.id))
              } catch (error) {
                setArchiveError(t.write.error[resourceWriteErrorKind(error)])
              }
            }}
            onClose={() => setDialog(null)}
          />
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

type DetailBodyProps = { organizationId: string; detail: ResourceDetail; onOpen: (resourceId: string) => void }

function ResourceDetailBody({ organizationId, detail, onOpen }: DetailBodyProps) {
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

      <ResourceComposition organizationId={organizationId} detail={detail} onOpen={onOpen} />

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
