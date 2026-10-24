import { LocaleSwitcher, formatMessage, intlLocales, useLocale } from '../../i18n'
import { budgetVariance, formatCurrency, formatDate, formatMonthYear } from './format'
import './home.css'

type SiteStatus = 'on-schedule' | 'at-risk'

type Site = {
  id: string
  name: string
  location: string
  status: SiteStatus
}

type ActivityItem = {
  id: string
  text: string
  when: string
}

type NavId = 'home' | 'sites' | 'people' | 'products' | 'finance' | 'crm'

const navItems: { id: NavId; active?: boolean }[] = [
  { id: 'home', active: true },
  { id: 'sites' },
  { id: 'people' },
  { id: 'products' },
  { id: 'finance' },
  { id: 'crm' },
]

// Static, UI-only data. Real data and routing arrive in later features.
const company = 'Construx Holdings'

const sites: Site[] = [
  { id: 'S-1042', name: 'Riverside Tower', location: 'Austin, TX', status: 'on-schedule' },
  { id: 'S-1098', name: 'Maple District', location: 'Denver, CO', status: 'at-risk' },
  { id: 'S-1107', name: 'Harbor Point', location: 'Seattle, WA', status: 'on-schedule' },
]

const activity: ActivityItem[] = [
  { id: 'a1', text: 'M. Chen assigned to Riverside Tower', when: '2h ago' },
  { id: 'a2', text: 'Cost entry recorded on Maple District', when: '5h ago' },
  { id: 'a3', text: 'Harbor Point budget updated', when: '1d ago' },
]

const people = { members: 42, assignedThisWeek: 12 }

export function HomePage() {
  const { locale, messages: m } = useLocale()
  const intlLocale = intlLocales[locale]
  const reportingPeriod = formatMonthYear('2026-10', intlLocale)
  const finance = {
    budget: 1_400_000,
    cost: 1_052_000,
    period: reportingPeriod,
    currency: 'USD' as const,
  }
  const variance = budgetVariance(finance.budget, finance.cost)
  const costRatio = finance.budget > 0 ? Math.min(finance.cost / finance.budget, 1) : 0

  return (
    <div className="home-page">
      <aside className="home-sidebar">
        <div className="home-brand">
          <span className="home-brand-mark" aria-hidden="true">C</span>
          <span>Construx</span>
        </div>
        <nav className="home-nav" aria-label={m.home.navLabel}>
          <ul>
            {navItems.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className={item.active ? 'is-active' : undefined}
                  aria-current={item.active ? 'page' : undefined}
                >
                  {m.home.nav[item.id]}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="home-sidebar__footer">
          <LocaleSwitcher />
        </div>
      </aside>

      <div className="home-body">
        <header className="home-context">
          <div className="home-context__scope">
            <strong>{company}</strong>
            <span className="home-context__dot" aria-hidden="true">·</span>
            <span>{m.home.allSites}</span>
            <span className="home-context__dot" aria-hidden="true">·</span>
            <span>{reportingPeriod}</span>
          </div>
          <span>{formatMessage(m.home.dataAsOf, { date: formatDate('2026-10-19', intlLocale) })}</span>
        </header>

        <main className="home-main">
          <div className="home-header">
            <div>
              <h1>{m.home.overviewTitle}</h1>
              <p>{m.home.overviewDescription}</p>
            </div>
            <button className="home-button--primary" type="button">{m.home.addSite}</button>
          </div>

          <div className="home-grid">
            <section className="home-card home-card--finance" aria-labelledby="finance-heading">
              <header className="home-card__header">
                <h2 id="finance-heading">{m.home.finance}</h2>
                <span className="home-badge home-badge--muted">{finance.period}</span>
              </header>

              {variance.status === 'no-data' ? (
                <p className="home-finance__delta home-finance__delta--no-data">
                  <span>{m.home.noData}</span>
                </p>
              ) : (
                <p className={`home-finance__delta home-finance__delta--${variance.status}`}>
                  {variance.status === 'savings' ? m.home.savings : m.home.overrun}{' '}
                  <span>{formatCurrency(variance.amount, finance.currency, intlLocale)}</span>
                </p>
              )}

              <dl className="home-finance__stats">
                <div>
                  <dt>{m.home.budget}</dt>
                  <dd>{formatCurrency(finance.budget, finance.currency, intlLocale)}</dd>
                </div>
                <div>
                  <dt>{m.home.recordedCost}</dt>
                  <dd>{formatCurrency(finance.cost, finance.currency, intlLocale)}</dd>
                </div>
              </dl>

              <div
                className="home-finance__bar"
                role="img"
                aria-label={formatMessage(m.home.budgetRecorded, { percent: Math.round(costRatio * 100) })}
              >
                <span
                  className="home-finance__bar-fill"
                  style={{ width: `${Math.round(costRatio * 100)}%` }}
                />
              </div>
            </section>

            <section className="home-card home-card--people" aria-labelledby="people-heading">
              <header className="home-card__header">
                <h2 id="people-heading">{m.home.people}</h2>
              </header>
              <p className="home-people__count">{people.members}</p>
              <p className="home-people__caption">
                {formatMessage(m.home.peopleCaption, {
                  count: people.members,
                  assigned: people.assignedThisWeek,
                })}
              </p>
            </section>

            <section className="home-card home-card--sites" aria-labelledby="sites-heading">
              <header className="home-card__header">
                <h2 id="sites-heading">{m.home.sites}</h2>
                <span className="home-badge home-badge--muted">
                  {formatMessage(m.home.sitesActive, { count: sites.length })}
                </span>
              </header>
              <ul className="home-sites">
                {sites.map((site) => (
                  <li className="home-sites__row" key={site.id}>
                    <div>
                      <p className="home-sites__name">{site.name}</p>
                      <p className="home-sites__meta">{site.location}</p>
                    </div>
                    <span
                      className={`home-badge ${site.status === 'at-risk' ? 'home-badge--warning' : 'home-badge--success'}`}
                    >
                      {site.status === 'at-risk' ? m.home.atRisk : m.home.onSchedule}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="home-card home-card--activity" aria-labelledby="activity-heading">
              <header className="home-card__header">
                <h2 id="activity-heading">{m.home.recentActivity}</h2>
              </header>
              <ul className="home-activity">
                {activity.map((item) => (
                  <li key={item.id}>
                    <span className="home-activity__text">{item.text}</span>
                    <span className="home-activity__when">{item.when}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
