import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useLocale } from '../../i18n'
import { useRemoteData } from '../../components/data/useRemoteData'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { usePermissions } from '../permissions'
import { deleteFloorPlan, listFloorPlans, type FloorPlan } from './floorPlansApi'
import { FloorPlanUploadDialog } from './FloorPlanUploadDialog'
import './floor-plans.css'

export function SiteFloorPlansPage() {
  const { siteId = '' } = useParams()
  const { messages: m } = useLocale()
  const t = m.floorPlans
  const organization = useCurrentOrganization()
  const { can } = usePermissions()
  const [showUpload, setShowUpload] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const orgId = organization?.id ?? ''
  const canManage = can('MANAGE_PLAN') ?? false
  const remote = useRemoteData(`floor-plans-${siteId}`, () => listFloorPlans(orgId, siteId))

  if (!siteId || !organization) return null

  function handleUploaded(fp: FloorPlan) {
    remote.update((prev) => (prev ? [fp, ...prev] : [fp]))
    setShowUpload(false)
    setNotice(t.uploaded)
    setTimeout(() => setNotice(null), 4000)
  }

  async function handleDelete(fp: FloorPlan) {
    if (!confirm(fp.name)) return
    setDeletingId(fp.id)
    try {
      await deleteFloorPlan(orgId, siteId, fp.id)
      remote.update((prev) => prev?.filter((p) => p.id !== fp.id) ?? [])
      setNotice(t.deleted)
      setTimeout(() => setNotice(null), 4000)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <main className="page-content">
      <header className="page-header">
        <nav aria-label="breadcrumb" className="breadcrumb">
          <Link to={`/sites/${encodeURIComponent(siteId)}`}>{m.sites.detail.back}</Link>
          <span aria-hidden>›</span>
          <span>{t.title}</span>
        </nav>
        <div className="page-header__row">
          <h1>{t.title}</h1>
          {canManage ? (
            <button type="button" className="button button--primary" onClick={() => setShowUpload(true)}>
              {t.upload}
            </button>
          ) : null}
        </div>
        <p className="page-header__description">{t.description}</p>
      </header>

      {notice ? <div className="notice notice--success" role="status">{notice}</div> : null}

      {remote.status === 'loading' ? (
        <p className="loading-text">{t.loading}</p>
      ) : remote.status === 'error' ? (
        <div>
          <p className="error-text">{t.loadError}</p>
          <button type="button" className="button" onClick={() => remote.reload()}>
            {t.retry}
          </button>
        </div>
      ) : remote.data?.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state__title">{t.emptyTitle}</p>
          <p className="empty-state__body">{canManage ? t.emptyBody : t.emptyBodyReadOnly}</p>
          {canManage ? (
            <button type="button" className="button button--primary" onClick={() => setShowUpload(true)}>
              {t.uploadFirst}
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="floor-plan-list" aria-label={t.title}>
          {remote.data?.map((fp) => (
            <li key={fp.id} className="floor-plan-card">
              <div className="floor-plan-card__thumb">
                {fp.status === 'READY' && fp.viewUrl ? (
                  <img src={fp.viewUrl} alt={fp.name} loading="lazy" />
                ) : (
                  <span className={`floor-plan-card__status floor-plan-card__status--${fp.status.toLowerCase()}`}>
                    {m.floorPlans.status[fp.status]}
                  </span>
                )}
              </div>
              <div className="floor-plan-card__info">
                <p className="floor-plan-card__name">{fp.name}</p>
                {fp.level ? <p className="floor-plan-card__meta">{fp.level}</p> : null}
                <div className="button-row">
                  <Link
                    className="button"
                    to={`/sites/${encodeURIComponent(siteId)}/floor-plans/${encodeURIComponent(fp.id)}`}
                  >
                    {t.open.replace('{name}', fp.name)}
                  </Link>
                  {canManage ? (
                    <button
                      type="button"
                      className="button button--danger"
                      disabled={deletingId === fp.id}
                      onClick={() => void handleDelete(fp)}
                    >
                      {deletingId === fp.id ? t.deleting : t.delete}
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showUpload ? (
        <FloorPlanUploadDialog
          organizationId={orgId}
          siteId={siteId}
          onUploaded={handleUploaded}
          onClose={() => setShowUpload(false)}
        />
      ) : null}
    </main>
  )
}
