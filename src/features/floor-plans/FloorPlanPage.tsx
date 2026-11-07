import { useCallback, useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router'
import { useLocale } from '../../i18n'
import { useRemoteData } from '../../components/data/useRemoteData'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { getFloorPlan, viewUrlExpiresSoon } from './floorPlansApi'
import { FloorPlanViewer } from './FloorPlanViewer'
import './floor-plans.css'

export function FloorPlanPage() {
  const { siteId = '', floorPlanId = '' } = useParams()
  const { messages: m } = useLocale()
  const t = m.floorPlans
  const organization = useCurrentOrganization()

  const orgId = organization?.id ?? ''
  const remote = useRemoteData(`floor-plan-${floorPlanId}`, () => getFloorPlan(orgId, siteId, floorPlanId))
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const floorPlan = remote.data
  const shouldPoll = floorPlan?.status === 'PENDING' || floorPlan?.status === 'PROCESSING'

  // Poll every 3 seconds while PENDING or PROCESSING
  useEffect(() => {
    if (shouldPoll) {
      pollingRef.current = setInterval(() => {
        remote.reload()
      }, 3000)
    } else {
      if (pollingRef.current !== null) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
    return () => {
      if (pollingRef.current !== null) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [shouldPoll, remote])

  const handleRefreshNeeded = useCallback(() => {
    remote.reload()
  }, [remote])

  // Refresh when the view URL is about to expire
  useEffect(() => {
    if (!floorPlan) return
    const interval = setInterval(() => {
      if (viewUrlExpiresSoon(floorPlan)) {
        remote.reload()
      }
    }, 60_000)
    return () => clearInterval(interval)
  }, [floorPlan, remote])

  if (!siteId || !floorPlanId || !organization) return null

  return (
    <main className="page-content">
      <header className="page-header">
        <nav aria-label="breadcrumb" className="breadcrumb">
          <Link to={`/sites/${encodeURIComponent(siteId)}/floor-plans`}>{t.back}</Link>
          {floorPlan ? (
            <>
              <span aria-hidden>›</span>
              <span>{floorPlan.name}</span>
            </>
          ) : null}
        </nav>
        {floorPlan ? (
          <div className="page-header__row">
            <h1>{floorPlan.name}</h1>
            <span
              className={`floor-plan-status-badge floor-plan-status-badge--${floorPlan.status.toLowerCase()}`}
              role="status"
            >
              {t.status[floorPlan.status]}
            </span>
          </div>
        ) : null}
        {floorPlan?.level ? <p className="page-header__description">{floorPlan.level}</p> : null}
        {floorPlan?.description ? <p className="page-header__description">{floorPlan.description}</p> : null}
      </header>

      {remote.status === 'loading' ? (
        <p className="loading-text">{t.loading}</p>
      ) : remote.status === 'error' ? (
        <div>
          <p className="error-text">{t.loadError}</p>
          <button type="button" className="button" onClick={() => remote.reload()}>
            {t.retry}
          </button>
        </div>
      ) : floorPlan ? (
        <>
          {floorPlan.status === 'PENDING' || floorPlan.status === 'PROCESSING' ? (
            <div className="floor-plan-processing-notice" role="status">
              <p>{floorPlan.status === 'PENDING' ? t.pendingMessage : t.processingMessage}</p>
            </div>
          ) : floorPlan.status === 'ERROR' ? (
            <div className="floor-plan-error-banner" role="alert">
              <p>{t.errorMessage}</p>
              {floorPlan.errorReason ? <p><code>{floorPlan.errorReason}</code></p> : null}
            </div>
          ) : (
            <div className="floor-plan-viewer-wrap">
              <FloorPlanViewer floorPlan={floorPlan} onRefreshNeeded={handleRefreshNeeded} />
            </div>
          )}
        </>
      ) : null}
    </main>
  )
}
