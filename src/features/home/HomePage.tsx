import { budgetVariance, formatCurrency, formatDate } from './format'
import './home.css'

type SiteStatus = 'on-schedule' | 'at-risk'

type Site = {
  id: string
  name: string
  location: string
  status: SiteStatus
}

type FinanceSummary = {
  budget: number
  cost: number
  period: string
  currency: 'USD' | 'EUR' | 'ARS'
}

type ActivityItem = {
  id: string
  text: string
  when: string
}

const navItems = [
  { label: 'Home', active: true },
  { label: 'Sites' },
  { label: 'People' },
  { label: 'Products' },
  { label: 'Finance' },
  { label: 'CRM' },
]

// Static, UI-only data. Real data and routing arrive in later features.
const company = 'Construx Holdings'
const reportingPeriod = 'October 2026'

const sites: Site[] = [
  { id: 'S-1042', name: 'Riverside Tower', location: 'Austin, TX', status: 'on-schedule' },
  { id: 'S-1098', name: 'Maple District', location: 'Denver, CO', status: 'at-risk' },
  { id: 'S-1107', name: 'Harbor Point', location: 'Seattle, WA', status: 'on-schedule' },
]

const finance: FinanceSummary = {
  budget: 1_400_000,
  cost: 1_052_000,
  period: reportingPeriod,
  currency: 'USD',
}

const activity: ActivityItem[] = [
  { id: 'a1', text: 'M. Chen assigned to Riverside Tower', when: '2h ago' },
  { id: 'a2', text: 'Cost entry recorded on Maple District', when: '5h ago' },
  { id: 'a3', text: 'Harbor Point budget updated', when: '1d ago' },
]

const people = { members: 42, assignedThisWeek: 12 }

export function HomePage() {
  const variance = budgetVariance(finance.budget, finance.cost)
  const costRatio = finance.budget > 0 ? Math.min(finance.cost / finance.budget, 1) : 0

  return (
    <div className="home-page">
      <aside className="home-sidebar">
        <div className="home-brand">
          <span className="home-brand-mark" aria-hidden="true">C</span>
          <span>Construx</span>
        </div>
        <nav className="home-nav" aria-label="Workspace">
          <ul>
            {navItems.map((item) => (
              <li key={item.label}>
                <a
                  href={`#${item.label.toLowerCase()}`}
                  className={item.active ? 'is-active' : undefined}
                  aria-current={item.active ? 'page' : undefined}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="home-body">
        <header className="home-context">
          <div className="home-context__scope">
            <strong>{company}</strong>
            <span className="home-context__dot" aria-hidden="true">·</span>
            <span>All sites</span>
            <span className="home-context__dot" aria-hidden="true">·</span>
            <span>{reportingPeriod}</span>
          </div>
          <span>Data as of {formatDate('2026-10-19')}</span>
        </header>

        <main className="home-main">
          <div className="home-header">
            <div>
              <h1>Workspace overview</h1>
              <p>Your company&apos;s sites, team, and financial position at a glance.</p>
            </div>
            <button className="home-button--primary" type="button">Add site</button>
          </div>

          <div className="home-grid">
            <section className="home-card home-card--finance" aria-labelledby="finance-heading">
              <header className="home-card__header">
                <h2 id="finance-heading">Finance</h2>
                <span className="home-badge home-badge--muted">{finance.period}</span>
              </header>

              {variance.status === 'no-data' ? (
                <p className="home-finance__delta home-finance__delta--no-data">
                  <span>No data</span>
                </p>
              ) : (
                <p className={`home-finance__delta home-finance__delta--${variance.status}`}>
                  {variance.status === 'savings' ? 'Savings' : 'Overrun'}{' '}
                  <span>{formatCurrency(variance.amount, finance.currency)}</span>
                </p>
              )}

              <dl className="home-finance__stats">
                <div>
                  <dt>Budget</dt>
                  <dd>{formatCurrency(finance.budget, finance.currency)}</dd>
                </div>
                <div>
                  <dt>Recorded cost</dt>
                  <dd>{formatCurrency(finance.cost, finance.currency)}</dd>
                </div>
              </dl>

              <div
                className="home-finance__bar"
                role="img"
                aria-label={`${Math.round(costRatio * 100)}% of budget recorded`}
              >
                <span
                  className="home-finance__bar-fill"
                  style={{ width: `${Math.round(costRatio * 100)}%` }}
                />
              </div>
            </section>

            <section className="home-card home-card--people" aria-labelledby="people-heading">
              <header className="home-card__header">
                <h2 id="people-heading">People</h2>
              </header>
              <p className="home-people__count">{people.members}</p>
              <p className="home-people__caption">
                team members · {people.assignedThisWeek} assigned this week
              </p>
            </section>

            <section className="home-card home-card--sites" aria-labelledby="sites-heading">
              <header className="home-card__header">
                <h2 id="sites-heading">Sites</h2>
                <span className="home-badge home-badge--muted">{sites.length} active</span>
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
                      {site.status === 'at-risk' ? 'At risk' : 'On schedule'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="home-card home-card--activity" aria-labelledby="activity-heading">
              <header className="home-card__header">
                <h2 id="activity-heading">Recent activity</h2>
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
