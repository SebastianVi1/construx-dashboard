import type { Messages } from '../../i18n'
import type { SiteStatus } from './sitesApi'
import type { SiteProgress } from './siteHelpers'

const statusTone: Record<SiteStatus, string> = {
  PLANNED: 'neutral',
  ACTIVE: 'success',
  ON_HOLD: 'warning',
  COMPLETED: 'accent',
  ARCHIVED: 'muted',
}

export function SiteStatusBadge({ status, labels }: { status: SiteStatus; labels: Messages['sites']['status'] }) {
  return (
    <span className="badge" data-tone={statusTone[status]}>
      {labels[status]}
    </span>
  )
}

/** Done / total tasks with a thin meter. Only rendered when progress is known. */
export function ProgressMeter({ progress, label }: { progress: SiteProgress; label: string }) {
  return (
    <span className="site-progress">
      <span className="site-progress__track" aria-hidden="true">
        <span className="site-progress__fill" style={{ width: `${progress.percent}%` }} />
      </span>
      <span className="data-mono">{label}</span>
    </span>
  )
}
