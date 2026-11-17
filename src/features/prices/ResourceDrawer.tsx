import { useRef, useState, type ReactNode } from 'react'
import { useRemoteData } from '../../components/data/useRemoteData'
import { Modal } from '../../components/modal'
import { Notice, SkeletonBlock, SkeletonRegion } from '../../components/page'
import { useCurrency } from '../../currency'
import { formatMessage, useLocale, type Locale, type Messages } from '../../i18n'
import { getResource, listResourceCosts, type CostEntry, type ResourceDetail } from './pricesApi'
import { pricesLoadKind } from './pricesErrors'
import { ResourceBadges } from './ResourceBadges'
import { formatDay, formatInstant, hasMoreHistory } from './resourceDisplay'

type ResourceDrawerProps = {
  organizationId: string
  resourceId: string
  onClose: () => void
}

type PricesMessages = Messages['prices']

/** Everything the catalog knows about one Resource, beside the list it was opened from. */
export function ResourceDrawer({ organizationId, resourceId, onClose }: ResourceDrawerProps) {
  const { messages: m, locale } = useLocale()
  const t = m.prices
  const resource = useRemoteData(`${organizationId}:resource:${resourceId}`, () => getResource(organizationId, resourceId), {
    immediate: true,
  })
  const detail = resource.data

  return (
    <Modal variant="drawer" title={detail?.name ?? t.detail.loading} closeLabel={t.detail.close} onClose={onClose}>
      {detail ? (
        <ResourceDetailBody key={detail.id} organizationId={organizationId} detail={detail} t={t} locale={locale} />
      ) : resource.status === 'error' ? (
        <Notice tone="error" action={{ label: t.load.retry, onClick: resource.reload }}>
          {pricesLoadKind(resource.error) === 'notFound' ? t.detail.notFound : t.detail.generic}
        </Notice>
      ) : (
        <SkeletonRegion className="prices-detail" label={t.detail.loading}>
          <SkeletonBlock width="40%" height={36} />
          <SkeletonBlock width="70%" />
          <SkeletonBlock width="55%" />
          <SkeletonBlock width="65%" />
        </SkeletonRegion>
      )}
    </Modal>
  )
}

type BodyProps = { organizationId: string; detail: ResourceDetail; t: PricesMessages; locale: Locale }

function ResourceDetailBody({ organizationId, detail, t, locale }: BodyProps) {
  const { money } = useCurrency()
  const d = t.detail
  const flags = [
    detail.isComposite ? t.badge.composite : null,
    detail.isPercentage ? t.badge.percentage : null,
    detail.isHourlyCost ? t.badge.hourly : null,
    detail.discontinued ? t.badge.discontinued : null,
  ].filter((flag): flag is string => flag !== null)

  return (
    <div className="prices-detail">
      <div className="prices-detail__head">
        <p className="prices-detail__code data-mono">{detail.code}</p>
        <ResourceBadges resource={detail} />
      </div>

      <section className="prices-detail__cost" aria-label={d.currentCost}>
        <p className="prices-detail__cost-label">{d.currentCost}</p>
        {detail.currentCost === null ? (
          <p className="prices-detail__cost-value prices-detail__cost-value--none">{t.noCost}</p>
        ) : (
          <p className="prices-detail__cost-value data-mono">
            {money(Number(detail.currentCost))}
            <span className="prices-detail__per">{formatMessage(d.perUnit, { unit: detail.unit.code })}</span>
          </p>
        )}
        {detail.costUpdatedAt ? (
          <p className="prices-detail__cost-date">{formatMessage(d.costUpdatedAt, { date: formatInstant(detail.costUpdatedAt, locale) })}</p>
        ) : null}
      </section>

      <section className="prices-detail__section">
        <h3>{d.fields}</h3>
        <dl className="prices-fields">
          <DetailRow label={d.code} mono>{detail.code}</DetailRow>
          <DetailRow label={d.type}>{t.type[detail.type]}</DetailRow>
          <DetailRow label={d.description} wide>{detail.description}</DetailRow>
          <DetailRow label={d.unit} mono>{detail.unit.code}</DetailRow>
          <DetailRow label={d.family}>{detail.family ? `${detail.family.name} (${detail.family.code})` : null}</DetailRow>
          <DetailRow label={d.supplier}>{detail.supplier?.name}</DetailRow>
          <DetailRow label={d.brand}>{detail.brand}</DetailRow>
          <DetailRow label={d.reference}>{detail.reference}</DetailRow>
          <DetailRow label={d.sapCode} mono>{detail.sapCode}</DetailRow>
          <DetailRow label={d.technicalSheet} wide>{detail.technicalSheet}</DetailRow>
          <DetailRow label={d.procedure} wide>{detail.procedure}</DetailRow>
          <DetailRow label={d.grouper} mono>{detail.grouper}</DetailRow>
          <DetailRow label={d.flags}>{flags.length > 0 ? flags.join(', ') : d.noFlags}</DetailRow>
          <DetailRow label={d.source}>{t.source[detail.source]}</DetailRow>
          <DetailRow label={d.importedCost} mono>{detail.importedCost === null ? null : money(Number(detail.importedCost))}</DetailRow>
          <DetailRow label={d.importedCostOn}>{detail.importedCostOn ? formatDay(detail.importedCostOn, locale) : null}</DetailRow>
          <DetailRow label={d.missingFromImportAt}>
            {detail.missingFromImportAt ? formatInstant(detail.missingFromImportAt, locale) : null}
          </DetailRow>
          <DetailRow label={d.archivedAt}>{detail.archivedAt ? formatInstant(detail.archivedAt, locale) : null}</DetailRow>
          <DetailRow label={d.createdAt}>{formatInstant(detail.createdAt, locale)}</DetailRow>
          <DetailRow label={d.updatedAt}>{formatInstant(detail.updatedAt, locale)}</DetailRow>
        </dl>
      </section>

      <CostHistory organizationId={organizationId} detail={detail} t={t} locale={locale} />
    </div>
  )
}

/** One label and value; empty optional fields are left out instead of showing a column of dashes. */
function DetailRow({ label, children, mono = false, wide = false }: { label: string; children: ReactNode; mono?: boolean; wide?: boolean }) {
  if (children === null || children === undefined || children === '') return null
  return (
    <div className="prices-fields__row" data-wide={wide || undefined}>
      <dt>{label}</dt>
      <dd className={mono ? 'data-mono' : undefined}>{children}</dd>
    </div>
  )
}

function CostHistory({ organizationId, detail, t, locale }: BodyProps) {
  const d = t.detail
  const [full, setFull] = useState<CostEntry[] | null>(null)
  const [loadingAll, setLoadingAll] = useState(false)
  const [failed, setFailed] = useState(false)
  const running = useRef(false)
  const entries = full ?? detail.history ?? []

  async function loadAll() {
    if (running.current) return
    running.current = true
    setLoadingAll(true)
    setFailed(false)
    try {
      const all: CostEntry[] = []
      for (let page = 0; ; page += 1) {
        const answer = await listResourceCosts(organizationId, detail.id, page)
        all.push(...answer.content)
        if (page + 1 >= answer.totalPages) break
      }
      setFull(all)
    } catch {
      setFailed(true)
    } finally {
      running.current = false
      setLoadingAll(false)
    }
  }

  return (
    <section className="prices-detail__section">
      <h3>{d.history}</h3>
      {detail.isComposite ? (
        <p className="prices-detail__note">{d.compositeHistory}</p>
      ) : entries.length === 0 ? (
        <p className="prices-detail__note">{d.noHistory}</p>
      ) : (
        <>
          <p className="prices-detail__note">{d.historyHint}</p>
          <ol className="prices-history">
            {entries.map((entry) => (
              <CostHistoryEntry key={entry.id} entry={entry} t={t} locale={locale} />
            ))}
          </ol>
          {full ? (
            <p className="prices-detail__note">{formatMessage(d.allShown, { count: full.length })}</p>
          ) : hasMoreHistory(entries.length) ? (
            <div className="prices-history__more">
              {failed ? <Notice tone="error">{d.loadAllError}</Notice> : null}
              <button type="button" className="button button--small" disabled={loadingAll} aria-busy={loadingAll} onClick={loadAll}>
                {loadingAll ? d.loadingAll : d.loadAll}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}

function CostHistoryEntry({ entry, t, locale }: { entry: CostEntry; t: PricesMessages; locale: Locale }) {
  const { money } = useCurrency()
  const d = t.detail
  const meta = [
    t.source[entry.source],
    entry.recordedBy ? formatMessage(d.recordedBy, { name: entry.recordedBy.fullName }) : null,
    entry.supplier?.name ?? null,
    entry.sku ? formatMessage(d.sku, { sku: entry.sku }) : null,
  ].filter((part): part is string => part !== null)

  return (
    <li className="prices-history__entry">
      <p className="prices-history__amount data-mono">{money(Number(entry.amount))}</p>
      <p className="prices-history__date">{formatMessage(d.effectiveFrom, { date: formatInstant(entry.effectiveFrom, locale) })}</p>
      <p className="prices-history__meta">{meta.join(', ')}</p>
      {entry.note ? <p className="prices-history__note">{entry.note}</p> : null}
    </li>
  )
}
