import { useEffect, useEffectEvent, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRemoteData } from '../../components/data/useRemoteData'
import { Notice, SkeletonRows } from '../../components/page'
import { useCurrency } from '../../currency'
import { formatDateTime, formatMessage, useLocale } from '../../i18n'
import { ApiError } from '../../lib/http'
import { listResources } from '../prices/pricesApi'
import '../prices/prices.css'
import {
  getLaborRate,
  laborRateBody,
  laborRateDraft,
  laborRateErrorKind,
  laborRateKinds,
  setLaborRate,
  type LaborRate,
  type LaborRateDraft,
  type LaborRateDraftError,
  type LaborRateErrorKind,
  type LaborRateView,
} from './laborRate'
import type { SiteAccess } from './sitesApi'

type LaborRateDrawerProps = {
  organizationId: string
  siteId: string
  person: SiteAccess
  /** MANAGE_PROJECT on the site: show the editor. */
  canManage: boolean
  onSaved: (person: SiteAccess) => void
  onClose: () => void
}

/** A person's Labor rate on a site: current rate, editor (MANAGE_PROJECT) and history with who set each one. */
export function LaborRateDrawer({ organizationId, siteId, person, canManage, onSaved, onClose }: LaborRateDrawerProps) {
  const { messages: m } = useLocale()
  const t = m.sites.people.rate
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const view = useRemoteData(
    `${organizationId}:${siteId}:labor-rate:${person.accessId}`,
    () => getLaborRate(organizationId, siteId, person.accessId),
    { remember: false, immediate: true },
  )

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === 'Escape') onClose()
  })

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    panelRef.current?.focus()
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const name = person.fullName || m.sites.people.unnamed
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
            <p className="prices-drawer__code">{t.title}</p>
            <h2 id={titleId}>{name}</h2>
          </div>
          <button type="button" className="button button--small" onClick={onClose}>
            {t.close}
          </button>
        </header>
        <div className="prices-drawer__body">
          {view.data ? (
            <>
              <section>
                <h3>{t.current}</h3>
                {view.data.current ? <RateLine rate={view.data.current} /> : <p className="cell-muted">{t.notSet}</p>}
              </section>
              {canManage ? (
                <RateEditor
                  organizationId={organizationId}
                  siteId={siteId}
                  accessId={person.accessId}
                  view={view.data}
                  onSaved={(next) => {
                    onSaved(next)
                    view.reload()
                  }}
                />
              ) : null}
              <section>
                <h3>{t.history}</h3>
                {view.data.history.length === 0 ? (
                  <p className="cell-muted">{t.historyEmpty}</p>
                ) : (
                  <ol className="labor-rate-history">
                    {view.data.history.map((rate) => (
                      <li key={rate.effectiveFrom}>
                        <RateLine rate={rate} />
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </>
          ) : view.status === 'error' ? (
            <Notice tone="error" action={{ label: m.sites.load.retry, onClick: view.reload }}>
              {t.error[laborRateErrorKind(view.error)]}
            </Notice>
          ) : (
            <SkeletonRows rows={4} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** "MO011 PEON · $610.00 per day", and when and by whom it was set. */
function RateLine({ rate }: { rate: LaborRate }) {
  const { messages: m, locale } = useLocale()
  const t = m.sites.people.rate
  return (
    <div className="labor-rate-line">
      <strong>{rateSummary(rate, t)}</strong>
      <RateAmount rate={rate} />
      <span className="cell-muted">
        {formatMessage(t.since, { date: formatDateTime(rate.effectiveFrom, locale), name: rate.setBy.fullName || t.someone })}
      </span>
    </div>
  )
}

type RateMessages = ReturnType<typeof useLocale>['messages']['sites']['people']['rate']

function rateSummary(rate: LaborRate, t: RateMessages): string {
  if (rate.kind === 'NONE') return t.none
  if (rate.kind === 'FIXED') return t.fixed
  return rate.laborCategory ? formatMessage(t.catalog, { code: rate.laborCategory.code, name: rate.laborCategory.name }) : t.kind.CATALOG
}

function RateAmount({ rate }: { rate: LaborRate }) {
  const { messages: m } = useLocale()
  const { money } = useCurrency()
  const t = m.sites.people.rate
  if (rate.kind === 'NONE') return null
  if (rate.dailyAmount === null) return <span className="cell-muted">{t.noCost}</span>
  return <span className="data-mono">{formatMessage(t.perDay, { amount: money(Number(rate.dailyAmount)) })}</span>
}

/** Compact current rate for the people table; "Not set" without a rate. */
export function RateCell({ rate }: { rate: LaborRate | null }) {
  const { messages: m } = useLocale()
  const t = m.sites.people.rate
  if (!rate) return <span className="cell-muted">{t.notSet}</span>
  return (
    <span className="labor-rate-cell">
      <span>{rateSummary(rate, t)}</span>
      <RateAmount rate={rate} />
    </span>
  )
}

type RateEditorProps = {
  organizationId: string
  siteId: string
  accessId: string
  view: LaborRateView
  onSaved: (person: SiteAccess) => void
}

function RateEditor({ organizationId, siteId, accessId, view, onSaved }: RateEditorProps) {
  const { messages: m } = useLocale()
  const t = m.sites.people.rate
  const amountId = useId()
  const [draft, setDraft] = useState<LaborRateDraft>(() => laborRateDraft(view))
  const [invalid, setInvalid] = useState<LaborRateDraftError | null>(null)
  const [errorKind, setErrorKind] = useState<LaborRateErrorKind | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  async function save() {
    const result = laborRateBody(draft)
    setSaved(false)
    setErrorKind(null)
    if (!result.ok) {
      setInvalid(result.error)
      return
    }
    setInvalid(null)
    setBusy(true)
    try {
      onSaved(await setLaborRate(organizationId, siteId, accessId, result.body))
      setSaved(true)
    } catch (error) {
      setErrorKind(laborRateErrorKind(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <h3>{t.edit}</h3>
      <form
        className="labor-rate-editor"
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        {draft.suggestedFrom ? <Notice>{formatMessage(t.suggested, { site: draft.suggestedFrom })}</Notice> : null}
        <fieldset className="labor-rate-kinds">
          <legend>{t.kindLabel}</legend>
          {laborRateKinds.map((kind) => (
            <label key={kind} className="labor-rate-kind">
              <input
                type="radio"
                name="labor-rate-kind"
                value={kind}
                checked={draft.kind === kind}
                disabled={busy}
                onChange={() => setDraft({ ...draft, kind })}
              />
              <span>
                <strong>{t.kind[kind]}</strong>
                <span className="cell-muted">{t.kindHint[kind]}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {draft.kind === 'CATALOG' ? (
          <CategoryPicker
            organizationId={organizationId}
            chosen={draft.category}
            disabled={busy}
            onChoose={(category) => setDraft({ ...draft, category })}
          />
        ) : null}
        {draft.kind === 'FIXED' ? (
          <label className="labor-rate-amount" htmlFor={amountId}>
            <span>{t.amountLabel}</span>
            <input
              id={amountId}
              className="input"
              inputMode="decimal"
              value={draft.amount}
              disabled={busy}
              aria-invalid={invalid === 'amount'}
              onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
            />
          </label>
        ) : null}
        {invalid ? <Notice tone="error">{t.invalid[invalid]}</Notice> : null}
        {errorKind ? <Notice tone="error">{t.error[errorKind]}</Notice> : saved ? <Notice tone="success">{t.saved}</Notice> : null}
        <div>
          <button type="submit" className="button button--primary" disabled={busy} aria-busy={busy}>
            {busy ? t.saving : t.save}
          </button>
        </div>
      </form>
    </section>
  )
}

type CategoryPickerProps = {
  organizationId: string
  chosen: LaborRateDraft['category']
  disabled: boolean
  onChoose: (category: NonNullable<LaborRateDraft['category']>) => void
}

/** Simple, active Labor categories of the catalog (needs VIEW_PRICES), searched by code or name. */
function CategoryPicker({ organizationId, chosen, disabled, onChoose }: CategoryPickerProps) {
  const { messages: m } = useLocale()
  const { money } = useCurrency()
  const t = m.sites.people.rate
  const searchId = useId()
  const [query, setQuery] = useState('')
  const text = query.trim()
  const results = useRemoteData(
    `${organizationId}:labor-categories:${text}`,
    () => listResources(organizationId, { types: ['LABOR'], composite: false, query: text, page: 0, size: 20 }),
    { immediate: true },
  )

  return (
    <div className="labor-rate-picker">
      <label htmlFor={searchId}>{t.searchLabel}</label>
      <input
        id={searchId}
        className="input"
        type="search"
        value={query}
        placeholder={t.searchPlaceholder}
        disabled={disabled}
        onChange={(event) => setQuery(event.target.value)}
      />
      {chosen ? <p className="labor-rate-picker__chosen">{formatMessage(t.chosen, { code: chosen.code, name: chosen.name })}</p> : null}
      {results.data ? (
        results.data.content.length === 0 ? (
          <p className="cell-muted">{t.searchEmpty}</p>
        ) : (
          <ul className="labor-rate-picker__list">
            {results.data.content.map((resource) => (
              <li key={resource.id}>
                <button
                  type="button"
                  className="labor-rate-picker__option"
                  aria-pressed={chosen?.id === resource.id}
                  disabled={disabled}
                  onClick={() =>
                    onChoose({ id: resource.id, code: resource.code, name: resource.name, realWage: resource.currentCost })
                  }
                >
                  <span className="data-mono">{resource.code}</span>
                  <span>{resource.name}</span>
                  <span className="data-mono">{resource.currentCost === null ? t.noCost : money(Number(resource.currentCost))}</span>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : results.status === 'error' ? (
        <Notice>
          {results.error instanceof ApiError && results.error.status === 403 ? t.searchForbidden : t.searchError}
        </Notice>
      ) : (
        <SkeletonRows rows={3} />
      )}
    </div>
  )
}
