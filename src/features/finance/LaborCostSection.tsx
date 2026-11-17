import { useId, useState, type FormEvent } from 'react'
import { useRemoteData } from '../../components/data/useRemoteData'
import { Notice, SkeletonRows, SkeletonTable } from '../../components/page'
import { useCurrency } from '../../currency'
import { formatMessage, useLocale } from '../../i18n'
import { dateText } from '../sites/siteDisplay'
import {
  getLaborCost,
  laborRangeIssue,
  listLaborCostDays,
  type AccrualRate,
  type LaborRange,
  type LaborRangeIssue,
  type PersonCost,
} from './laborCost'

const DAYS_PAGE_SIZE = 20

type LaborCostSectionProps = {
  organizationId: string
  siteId: string
}

type LaborMessages = ReturnType<typeof useLocale>['messages']['finance']['labor']

/**
 * The site's Accrued labor cost (docs/pricing.md §6.3): totals and one row per person over a period, and the
 * days behind a person with the rate of each day. Render only with VIEW_BUDGET.
 */
export function LaborCostSection({ organizationId, siteId }: LaborCostSectionProps) {
  const { messages: m, locale } = useLocale()
  const { money } = useCurrency()
  const t = m.finance.labor
  const fromId = useId()
  const toId = useId()
  const [draft, setDraft] = useState<{ from: string; to: string }>({ from: '', to: '' })
  const [range, setRange] = useState<LaborRange>({})
  const [issue, setIssue] = useState<LaborRangeIssue | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const report = useRemoteData(
    `${organizationId}:${siteId}:labor-cost:${range.from ?? ''}:${range.to ?? ''}`,
    () => getLaborCost(organizationId, siteId, range),
  )

  function apply(event: FormEvent) {
    event.preventDefault()
    const found = laborRangeIssue(draft.from, draft.to)
    setIssue(found)
    if (found) return
    setOpen(null)
    setRange({ from: draft.from || undefined, to: draft.to || undefined })
  }

  function reset() {
    setDraft({ from: '', to: '' })
    setIssue(null)
    setOpen(null)
    setRange({})
  }

  const data = report.data
  return (
    <section className="labor-cost" aria-labelledby={`${fromId}-title`}>
      <div className="labor-cost__header">
        <h3 id={`${fromId}-title`}>{t.title}</h3>
        <p>{t.intro}</p>
      </div>

      <form className="labor-cost__range" onSubmit={apply} noValidate>
        <label htmlFor={fromId}>
          <span>{t.from}</span>
          <input
            id={fromId}
            type="date"
            className="form-field__control"
            value={draft.from}
            onChange={(event) => setDraft({ ...draft, from: event.target.value })}
          />
        </label>
        <label htmlFor={toId}>
          <span>{t.to}</span>
          <input
            id={toId}
            type="date"
            className="form-field__control"
            value={draft.to}
            onChange={(event) => setDraft({ ...draft, to: event.target.value })}
          />
        </label>
        <div className="button-row">
          <button type="submit" className="button button--small">
            {t.apply}
          </button>
          {range.from || range.to ? (
            <button type="button" className="button button--small" onClick={reset}>
              {t.reset}
            </button>
          ) : null}
        </div>
        {issue ? (
          <p className="labor-cost__issue" role="alert">
            {t.rangeIssue[issue]}
          </p>
        ) : null}
      </form>

      {report.status === 'error' ? (
        <Notice tone="error" action={{ label: m.finance.retry, onClick: report.reload }}>
          {t.loadError}
        </Notice>
      ) : !data ? (
        <SkeletonTable columns={4} compact />
      ) : (
        <>
          <dl className="labor-cost__totals">
            <div>
              <dt>{t.total}</dt>
              <dd className="data-mono">{money(Number(data.total))}</dd>
            </div>
            <div>
              <dt>{t.personDays}</dt>
              <dd className="data-mono">{data.personDays}</dd>
            </div>
          </dl>
          <p className="cell-muted labor-cost__period">
            {formatMessage(t.range, { from: dateText(data.from, locale), to: dateText(data.to, locale) })}
          </p>
          {data.unratedPersonDays > 0 ? (
            <p className="labor-cost__hint">
              <span className="badge" data-tone="warning">
                {formatMessage(t.unratedDays, { count: data.unratedPersonDays })}
              </span>{' '}
              {t.unratedHint}
            </p>
          ) : null}
          {data.people.length === 0 ? (
            <p className="site-budget__empty">{t.empty}</p>
          ) : (
            <div className="table-scroll">
              <table className="data-table data-table--compact labor-cost__table">
                <thead>
                  <tr>
                    <th scope="col">{t.column.person}</th>
                    <th scope="col" className="expense-table__amount">
                      {t.column.days}
                    </th>
                    <th scope="col" className="expense-table__amount">
                      {t.column.amount}
                    </th>
                    <th scope="col">{t.column.currentRate}</th>
                    <th scope="col" className="cell-actions">
                      <span className="visually-hidden">{t.showDays}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.people.map((person) => (
                    <PersonRows
                      key={person.membershipId}
                      person={person}
                      open={open === person.membershipId}
                      onToggle={() => setOpen(open === person.membershipId ? null : person.membershipId)}
                      organizationId={organizationId}
                      siteId={siteId}
                      range={{ from: data.from, to: data.to }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}

type PersonRowsProps = {
  person: PersonCost
  open: boolean
  onToggle: () => void
  organizationId: string
  siteId: string
  range: { from: string; to: string }
}

function PersonRows({ person, open, onToggle, organizationId, siteId, range }: PersonRowsProps) {
  const { messages: m } = useLocale()
  const { money } = useCurrency()
  const t = m.finance.labor
  const name = person.fullName || t.unnamed
  const panelId = useId()
  return (
    <>
      <tr>
        <td>{name}</td>
        <td className="data-mono expense-table__amount">{person.days}</td>
        <td className="data-mono expense-table__amount">
          {money(Number(person.amount))}
          {person.unratedDays > 0 ? (
            <span className="badge labor-cost__badge" data-tone="warning">
              {formatMessage(t.unratedDays, { count: person.unratedDays })}
            </span>
          ) : null}
        </td>
        <td>
          <RateText rate={person.currentRate} t={t} />
        </td>
        <td className="cell-actions">
          <button
            type="button"
            className="button button--small"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? t.hideDays : formatMessage(t.showDaysLabel, { name })}
            onClick={onToggle}
          >
            {open ? t.hideDays : t.showDays}
          </button>
        </td>
      </tr>
      {open ? (
        <tr className="labor-cost__drill">
          <td colSpan={5} id={panelId}>
            <PersonDays
              organizationId={organizationId}
              siteId={siteId}
              membershipId={person.membershipId}
              name={name}
              range={range}
            />
          </td>
        </tr>
      ) : null}
    </>
  )
}

type PersonDaysProps = {
  organizationId: string
  siteId: string
  membershipId: string
  name: string
  range: { from: string; to: string }
}

/** One person's days over the period, newest first, with that day's rate and why it is unrated. */
function PersonDays({ organizationId, siteId, membershipId, name, range }: PersonDaysProps) {
  const { messages: m, locale } = useLocale()
  const { money } = useCurrency()
  const t = m.finance.labor
  const [page, setPage] = useState(0)
  const days = useRemoteData(
    `${organizationId}:${siteId}:labor-cost-days:${membershipId}:${range.from}:${range.to}:${page}`,
    () => listLaborCostDays(organizationId, siteId, { membershipId, ...range, page, size: DAYS_PAGE_SIZE }),
    { remember: false },
  )
  const data = days.data
  return (
    <div className="labor-cost__days">
      <h4>{formatMessage(t.daysOf, { name })}</h4>
      {days.status === 'error' ? (
        <Notice tone="error" action={{ label: m.finance.retry, onClick: days.reload }}>
          {t.loadError}
        </Notice>
      ) : !data ? (
        <SkeletonRows rows={3} />
      ) : (
        <>
          <table className="data-table data-table--compact">
            <thead>
              <tr>
                <th scope="col">{t.column.day}</th>
                <th scope="col">{t.column.rate}</th>
                <th scope="col" className="expense-table__amount">
                  {t.column.amount}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.content.map((day) => (
                <tr key={day.day}>
                  <td className="data-mono cell-muted">{dateText(day.day, locale)}</td>
                  <td>
                    <RateText rate={day.rate} t={t} />
                  </td>
                  <td className="data-mono expense-table__amount">
                    {money(Number(day.amount))}
                    {day.unratedReason ? (
                      <span className="badge labor-cost__badge" data-tone="warning">
                        {t.reason[day.unratedReason]}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.totalPages > 1 ? (
            <div className="button-row labor-cost__pager">
              <button type="button" className="button button--small" disabled={page === 0} onClick={() => setPage(page - 1)}>
                {t.previous}
              </button>
              <span className="cell-muted">
                {formatMessage(t.pageOf, { page: data.page + 1, pages: data.totalPages })}
              </span>
              <button
                type="button"
                className="button button--small"
                disabled={page + 1 >= data.totalPages}
                onClick={() => setPage(page + 1)}
              >
                {t.next}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

/** "MO011 PEON · $610.00 per day", "Fixed amount · …", or "No rate". */
function RateText({ rate, t }: { rate: AccrualRate | null; t: LaborMessages }) {
  const { money } = useCurrency()
  if (!rate || rate.kind === 'NONE') return <span className="cell-muted">{t.noRate}</span>
  const label =
    rate.kind === 'CATALOG' && rate.laborCategory
      ? formatMessage(t.catalog, { code: rate.laborCategory.code, name: rate.laborCategory.name })
      : rate.kind === 'CATALOG'
        ? t.column.rate
        : t.fixed
  return (
    <span className="labor-cost__rate">
      <span>{label}</span>
      {rate.dailyAmount === null ? (
        <span className="cell-muted">{t.noCost}</span>
      ) : (
        <span className="data-mono cell-muted">{formatMessage(t.perDay, { amount: money(Number(rate.dailyAmount)) })}</span>
      )}
    </span>
  )
}
