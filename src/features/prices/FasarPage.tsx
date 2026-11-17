import { useEffect, useState, type ReactNode } from 'react'
import { useRemoteData } from '../../components/data/useRemoteData'
import { BackLink, Notice, SkeletonTable } from '../../components/page'
import { formatMessage, intlLocales, useLocale, type Messages } from '../../i18n'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { usePermissions } from '../permissions'
import { fasarBody, fasarValuesFrom, validateFasar, type FasarErrors, type FasarValues } from './fasarForm'
import {
  fasarConcepts,
  fasarDayFields,
  fasarWriteErrorKind,
  getFasar,
  pricesErrorKind,
  replaceFasar,
  type Fasar,
  type FasarWriteErrorKind,
} from './pricesApi'
import { FasarStatusBadge } from './ResourceBadges'
import './prices.css'

type FasarMessages = Messages['prices']['fasar']

const TOAST_MS = 8000

/** FASAR parameters of the company (`/prices/fasar`): read with VIEW_PRICES, saved with MANAGE_PRICES. */
export function FasarPage() {
  const { messages: m } = useLocale()
  const t = m.prices.fasar
  const { can } = usePermissions()
  const organization = useCurrentOrganization()
  const fasar = useRemoteData(`${organization.id}:fasar`, () => getFasar(organization.id), { remember: false })

  useEffect(() => {
    document.title = `${t.title} | Construx`
  }, [t.title])

  if (!can('VIEW_PRICES')) {
    return (
      <div className="page">
        <Notice>{m.workspace.forbidden}</Notice>
      </div>
    )
  }

  return (
    <div className="page">
      <BackLink to="/prices">{t.back}</BackLink>
      <header className="page-header">
        <div className="page-header__text">
          <h1>{t.title}</h1>
          <p>{t.description}</p>
        </div>
      </header>
      {fasar.error ? (
        <Notice>{m.prices.load[pricesErrorKind(fasar.error)]}</Notice>
      ) : fasar.data ? (
        <FasarForm key={`${fasar.data.version ?? 0}`} stored={fasar.data} canManage={can('MANAGE_PRICES')} t={t} />
      ) : (
        <SkeletonTable columns={3} rows={6} />
      )}
    </div>
  )
}

type Toast = { tone: 'success' | 'error'; text: string; id: number }

function FasarForm({ stored, canManage, t }: { stored: Fasar; canManage: boolean; t: FasarMessages }) {
  const { locale } = useLocale()
  const organization = useCurrentOrganization()
  const [current, setCurrent] = useState(stored)
  const [values, setValues] = useState<FasarValues>(() => fasarValuesFrom(stored, new Date().getFullYear()))
  const [errors, setErrors] = useState<FasarErrors>({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)

  useEffect(() => {
    if (toast?.tone !== 'success') return
    const timer = setTimeout(() => setToast(null), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast])

  function edit(change: (draft: FasarValues) => void) {
    setValues((previous) => {
      const next: FasarValues = structuredClone(previous)
      change(next)
      return next
    })
  }

  async function save() {
    const found = validateFasar(values)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      setToast({ tone: 'error', text: t.invalidForm, id: Date.now() })
      return
    }
    setSaving(true)
    try {
      const saved = await replaceFasar(organization.id, fasarBody(values))
      setCurrent(saved)
      setValues(fasarValuesFrom(saved, new Date().getFullYear()))
      const r = saved.recomputation
      setToast({
        tone: 'success',
        text: r ? formatMessage(t.saved, { laborCategories: r.laborCategories, realWagesChanged: r.realWagesChanged, workItemsRecomputed: r.workItemsRecomputed }) : t.statusHint.COMPLETE,
        id: Date.now(),
      })
    } catch (error) {
      const kind: FasarWriteErrorKind = fasarWriteErrorKind(error)
      setToast({ tone: 'error', text: t.writeError[kind], id: Date.now() })
    } finally {
      setSaving(false)
    }
  }

  const disabled = !canManage || saving
  const dateTime = new Intl.DateTimeFormat(intlLocales[locale], { dateStyle: 'medium', timeStyle: 'short' })

  function input(key: string, label: string, value: string, onChange: (value: string) => void, hint?: string): ReactNode {
    const error = errors[key]
    const id = `fasar-${key.replaceAll('.', '-')}`
    return (
      <div className="form-field" data-state={error ? 'invalid' : 'idle'} key={key}>
        <label className="form-field__label" htmlFor={id}>
          {label}
        </label>
        <div className="form-field__box">
          <input
            className="form-field__control"
            id={id}
            inputMode="decimal"
            value={value}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
        {error ? (
          <p className="form-field__error" id={`${id}-error`} role="alert">
            {t.error[error]}
          </p>
        ) : hint ? (
          <p className="cell-muted">{hint}</p>
        ) : null}
      </div>
    )
  }

  return (
    <>
      <section className="page-section fasar-status" aria-label={t.title}>
        <div className="prices-badges">
          <FasarStatusBadge status={current.status} t={t} />
          {current.version !== null ? <span className="cell-muted">{formatMessage(t.version, { version: current.version })}</span> : null}
        </div>
        <p className="cell-muted">{t.statusHint[current.status]}</p>
        {current.updatedAt ? (
          <p className="cell-muted">
            {formatMessage(t.updated, { date: dateTime.format(new Date(current.updatedAt)), name: current.updatedBy?.fullName ?? '—' })}
          </p>
        ) : null}
        {current.laborCategories ? <p>{formatMessage(t.laborCategories, current.laborCategories)}</p> : null}
        {canManage ? null : <Notice>{t.readOnly}</Notice>}
      </section>

      <section className="page-section" aria-label={t.general}>
        <h2>{t.general}</h2>
        <div className="fasar-grid">
          {input('year', t.year, values.year, (v) => edit((d) => void (d.year = v)))}
          {input('uma', t.uma, values.uma, (v) => edit((d) => void (d.uma = v)))}
          {input('minimumWage', t.minimumWage, values.minimumWage, (v) => edit((d) => void (d.minimumWage = v)))}
        </div>
        <label className="prices-filters__check">
          <input
            type="checkbox"
            checked={values.sumEmployerAndWorker}
            disabled={disabled}
            onChange={(event) => edit((d) => void (d.sumEmployerAndWorker = event.target.checked))}
          />
          <span>{t.sumEmployerAndWorker}</span>
        </label>
      </section>

      <section className="page-section" aria-label={t.days}>
        <h2>{t.days}</h2>
        <p className="cell-muted">{t.daysHint}</p>
        {errors.days ? (
          <p className="form-error" role="alert">
            {t.error[errors.days]}
          </p>
        ) : null}
        <div className="fasar-grid">
          {fasarDayFields.map((field) => input(`days.${field}`, t.day[field], values.days[field], (v) => edit((d) => void (d.days[field] = v))))}
        </div>
      </section>

      <section className="page-section" aria-label={t.premiums}>
        <h2>{t.premiums}</h2>
        <p className="cell-muted">{t.premiumsHint}</p>
        <div className="fasar-grid">
          {input('vacationPct', t.vacationPct, values.vacationPct, (v) => edit((d) => void (d.vacationPct = v)))}
          {input('sundayPct', t.sundayPct, values.sundayPct, (v) => edit((d) => void (d.sundayPct = v)))}
          {input('otherChargesPct', t.otherChargesPct, values.otherChargesPct, (v) => edit((d) => void (d.otherChargesPct = v)))}
        </div>
      </section>

      <section className="page-section" aria-label={t.caps}>
        <h2>{t.caps}</h2>
        <div className="fasar-grid">
          {input('excessThresholdUma', t.excessThresholdUma, values.excessThresholdUma, (v) => edit((d) => void (d.excessThresholdUma = v)))}
          {input('sbcCapUma', t.sbcCapUma, values.sbcCapUma, (v) => edit((d) => void (d.sbcCapUma = v)))}
          {input('factorRounding', t.factorRounding, values.factorRounding, (v) => edit((d) => void (d.factorRounding = v)))}
        </div>
      </section>

      <section className="page-section" aria-label={t.contributions}>
        <h2>{t.contributions}</h2>
        <p className="cell-muted">{t.contributionsHint}</p>
        <div className="table-scroll">
          <table className="data-table prices-table">
            <thead>
              <tr>
                <th scope="col">{t.concept}</th>
                <th scope="col">{t.employerRate}</th>
                <th scope="col">{t.workerRate}</th>
              </tr>
            </thead>
            <tbody>
              {fasarConcepts.map((concept) => (
                <tr key={concept}>
                  <th scope="row">{t.conceptName[concept]}</th>
                  <td>
                    {input(`contributions.${concept}.employerRate`, `${t.conceptName[concept]} · ${t.employerRate}`, values.contributions[concept].employerRate, (v) =>
                      edit((d) => void (d.contributions[concept].employerRate = v)),
                    )}
                  </td>
                  <td>
                    {input(`contributions.${concept}.workerRate`, `${t.conceptName[concept]} · ${t.workerRate}`, values.contributions[concept].workerRate, (v) =>
                      edit((d) => void (d.contributions[concept].workerRate = v)),
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {current.derived ? (
        <section className="page-section" aria-label={t.derived}>
          <h2>{t.derived}</h2>
          <dl className="fasar-derived">
            <dt>{t.tp}</dt>
            <dd>{current.derived.tp}</dd>
            <dt>{t.tl}</dt>
            <dd>{current.derived.tl}</dd>
            <dt>{t.tpOverTl}</dt>
            <dd>{current.derived.tpOverTl}</dd>
            <dt>{t.fsbc}</dt>
            <dd>{current.derived.fsbc}</dd>
          </dl>
        </section>
      ) : null}

      {canManage ? (
        <div className="button-row button-row--end">
          <button type="button" className="button button--primary" disabled={saving} onClick={() => void save()}>
            {saving ? t.saving : t.save}
          </button>
        </div>
      ) : null}

      {toast ? (
        <div key={toast.id} className="prices-toast" data-tone={toast.tone} role={toast.tone === 'error' ? 'alert' : 'status'}>
          <p>{toast.text}</p>
          <button type="button" className="button button--small" onClick={() => setToast(null)}>
            {t.dismiss}
          </button>
        </div>
      ) : null}
    </>
  )
}
