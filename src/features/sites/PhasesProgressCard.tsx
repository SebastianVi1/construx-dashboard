import { useRemoteData } from '../../components/data/useRemoteData'
import { SkeletonList, Notice } from '../../components/page'
import { intlLocales, useLocale } from '../../i18n'
import { formatDate } from '../home/format'
import { listGoals } from '../goals/goalsApi'

type Props = {
  organizationId: string
  siteId: string
}

export function PhasesProgressCard({ organizationId, siteId }: Props) {
  const { messages: m, locale } = useLocale()
  const t = m.sites.overview
  const key = `${organizationId}:${siteId}:goals-progress`
  const goals = useRemoteData(key, () => listGoals(organizationId, siteId))

  if (goals.status === 'loading') return <SkeletonList />
  if (goals.status === 'error') {
    return (
      <Notice tone="error" action={{ label: m.sites.load.retry, onClick: goals.reload }}>
        {m.goals.loadError}
      </Notice>
    )
  }
  if (!goals.data || goals.data.length === 0) {
    return <p className="empty-state">{m.goals.emptyViewer}</p>
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>{t.phaseColumn.name}</th>
            <th>{t.phaseColumn.dates}</th>
            <th>{t.phaseColumn.tasks}</th>
            <th>{t.phaseColumn.progress}</th>
          </tr>
        </thead>
        <tbody>
          {goals.data.map((goal) => {
            const total = goal.activityCount ?? 0
            const done = goal.doneCount ?? 0
            const pct = total > 0 ? Math.round((done / total) * 100) : null
            return (
              <tr key={goal.id}>
                <td>{goal.name}</td>
                <td className="data-mono">
                  {formatDate(goal.startAt, intlLocales[locale])} –{' '}
                  {formatDate(goal.dueAt, intlLocales[locale])}
                </td>
                <td>
                  {total === 0 ? m.sites.noTasks : `${done} / ${total}`}
                </td>
                <td>
                  {pct === null ? '—' : `${pct}%`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
