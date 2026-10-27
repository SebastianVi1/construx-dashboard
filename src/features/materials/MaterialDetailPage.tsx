import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useRemoteData } from '../../components/data/useRemoteData'
import { ConfirmDialog } from '../../components/modal'
import { LoadingState, Notice } from '../../components/page'
import { formatMessage, useLocale } from '../../i18n'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { usePermissions } from '../permissions'
import { dateText } from '../sites/siteDisplay'
import { LatestPrices } from './MaterialBits'
import { RecordPriceDialog } from './RecordPriceDialog'
import { loadKind, supplierLabel } from './materialDisplay'
import { localToday, moneyText } from './priceRules'
import {
  archiveMaterial,
  deleteObservation,
  getMaterial,
  pricingErrorKind,
  type PriceObservation,
} from './pricingApi'
import './materials.css'

/** One material: its facts, latest price per supplier and full price history. */
export function MaterialDetailPage() {
  const { materialId = '' } = useParams()
  const { messages: m, locale } = useLocale()
  const t = m.materials
  const organization = useCurrentOrganization()
  const { can } = usePermissions()
  const canView = can('VIEW_PRICES')
  const canManage = can('MANAGE_PRICES')
  const material = useRemoteData(canView ? `${organization.id}:materials:${materialId}` : null, () =>
    getMaterial(organization.id, materialId),
  )
  const [recording, setRecording] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [removing, setRemoving] = useState<PriceObservation | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const name = material.data?.name

  useEffect(() => {
    document.title = `${name ?? t.title} | Construx`
  }, [name, t.title])

  if (!canView) {
    return (
      <div className="page">
        <Notice>{m.workspace.forbidden}</Notice>
      </div>
    )
  }

  if (!material.data) {
    return (
      <div className="page">
        <Link className="page-back" to="/materials">
          {t.detail.back}
        </Link>
        {material.status === 'error' ? (
          <Notice tone="error" action={{ label: t.load.retry, onClick: material.reload }}>
            {t.load[loadKind(pricingErrorKind(material.error))]}
          </Notice>
        ) : (
          <LoadingState label={t.detail.loading} />
        )}
      </div>
    )
  }

  const current = material.data
  const archived = current.archivedAt !== null
  const today = localToday()

  function closeDialogs() {
    setArchiving(false)
    setRemoving(null)
    setActionError(null)
  }

  async function archive() {
    try {
      const updated = await archiveMaterial(organization.id, current.id)
      material.update((detail) => ({ ...detail, ...updated }))
      closeDialogs()
    } catch (error) {
      setActionError(t.error[pricingErrorKind(error)])
    }
  }

  async function remove(observation: PriceObservation) {
    try {
      await deleteObservation(organization.id, observation.id)
      closeDialogs()
      setNotice(t.detail.deleted)
      material.reload()
    } catch (error) {
      setActionError(t.error[pricingErrorKind(error)])
    }
  }

  return (
    <div className="page">
      <Link className="page-back" to="/materials">
        {t.detail.back}
      </Link>

      <header className="page-header">
        <div className="page-header__text">
          {archived ? (
            <div className="material-sheet__status">
              <span className="badge" data-tone="muted">
                {t.detail.archived}
              </span>
            </div>
          ) : null}
          <h1>{current.name}</h1>
          <p>
            {current.brand || t.noBrand} · {t.category[current.category]} ·{' '}
            {formatMessage(t.perUnit, { unit: t.unit[current.unit] })}
          </p>
        </div>
        {canManage && !archived ? (
          <div className="button-row">
            <button type="button" className="button button--danger" onClick={() => setArchiving(true)}>
              {t.detail.archive}
            </button>
            <button type="button" className="button button--primary" onClick={() => setRecording(true)}>
              {t.recordPrice}
            </button>
          </div>
        ) : null}
      </header>

      {archived ? <Notice>{t.detail.archivedNotice}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      <section className="page-section" aria-labelledby="material-latest-heading">
        <div className="page-section__header">
          <h2 id="material-latest-heading">{t.detail.latestTitle}</h2>
        </div>
        <LatestPrices prices={current.latestPrices} today={today} t={t} locale={locale} />
      </section>

      <section className="page-section" aria-labelledby="material-history-heading">
        <div className="page-section__header">
          <h2 id="material-history-heading">{t.detail.historyTitle}</h2>
        </div>
        {current.history.length > 0 ? (
          <div className="table-scroll">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th scope="col">{t.detail.column.observedOn}</th>
                  <th scope="col">{t.detail.column.supplier}</th>
                  <th scope="col">{t.detail.column.price}</th>
                  <th scope="col">{t.detail.column.sku}</th>
                  <th scope="col">{t.detail.column.source}</th>
                  {canManage ? (
                    <th scope="col" className="cell-actions">
                      {t.detail.column.actions}
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {current.history.map((observation) => {
                  const supplier = supplierLabel({ name: observation.supplierName, branch: observation.supplierBranch })
                  const date = dateText(observation.observedOn, locale)
                  return (
                    <tr key={observation.id}>
                      <td className="data-mono">{date}</td>
                      <td>{supplier}</td>
                      <td className="data-mono">{moneyText(observation.price, locale)}</td>
                      <td className={observation.sku ? 'data-mono' : 'cell-muted'}>{observation.sku ?? '—'}</td>
                      <td>{t.detail.source[observation.source]}</td>
                      {canManage ? (
                        <td className="cell-actions">
                          <button
                            type="button"
                            className="button button--small button--danger"
                            aria-label={formatMessage(t.detail.deleteLabel, { supplier, date })}
                            onClick={() => setRemoving(observation)}
                          >
                            {t.detail.delete}
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>{t.detail.historyEmpty}</p>
          </div>
        )}
      </section>

      {recording ? (
        <RecordPriceDialog
          organizationId={organization.id}
          materialId={current.id}
          onRecorded={() => {
            setRecording(false)
            setNotice(t.detail.recorded)
            material.reload()
          }}
          onClose={() => setRecording(false)}
        />
      ) : null}
      {archiving ? (
        <ConfirmDialog
          title={t.detail.archiveTitle}
          body={t.detail.archiveBody}
          confirmLabel={t.detail.archiveConfirm}
          pendingLabel={t.detail.archiving}
          cancelLabel={t.detail.cancel}
          error={actionError}
          onConfirm={archive}
          onClose={closeDialogs}
        />
      ) : null}
      {removing ? (
        <ConfirmDialog
          title={t.detail.deleteTitle}
          body={t.detail.deleteBody}
          confirmLabel={t.detail.deleteConfirm}
          pendingLabel={t.detail.deleting}
          cancelLabel={t.detail.cancel}
          error={actionError}
          onConfirm={() => remove(removing)}
          onClose={closeDialogs}
        >
          <p className="material-confirm__detail">
            {supplierLabel({ name: removing.supplierName, branch: removing.supplierBranch })} ·{' '}
            {moneyText(removing.price, locale)} · {dateText(removing.observedOn, locale)}
          </p>
        </ConfirmDialog>
      ) : null}
    </div>
  )
}
