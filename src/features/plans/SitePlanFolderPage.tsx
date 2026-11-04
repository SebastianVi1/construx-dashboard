import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { useRemoteData } from '../../components/data/useRemoteData'
import { BackLink, LoadingState, Notice } from '../../components/page'
import { useLocale, type Locale } from '../../i18n'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { usePermissions } from '../permissions'
import { hasPermission } from '../permissions/landing'
import { getDocumentFolders, type DocumentFolder } from '../documents/documentFoldersApi'
import { deletePlan, getSitePlans, type Plan } from './plansApi'
import { viewUrlExpired } from './planDisplay'
import { PlanUploadDialog } from './PlanUploadDialog'
import './plans.css'

function folderName(folder: DocumentFolder, locale: Locale) {
  return locale === 'es' ? folder.nameEs : folder.nameEn
}

/** Plan image grid for one document folder in a site. */
export function SitePlanFolderPage() {
  const { siteId = '', folderId = '' } = useParams()
  const { messages: m, locale } = useLocale()
  const t = m.plans
  const org = useCurrentOrganization()
  const { access, can } = usePermissions()
  const canManage = can('MANAGE_PROJECT', siteId)

  const folders = useRemoteData(`${org.id}:${siteId}:doc-folders`, () => getDocumentFolders(org.id, siteId))
  const remote = useRemoteData(`${org.id}:${siteId}:${folderId}:plans`, () => getSitePlans(org.id, siteId, folderId))

  const [uploadOpen, setUploadOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const currentFolder = folders.data?.find((f) => f.id === folderId)
  const title = currentFolder ? folderName(currentFolder, locale) : t.title

  useEffect(() => {
    document.title = `${title} · ${t.title} | Construx`
  }, [title, t.title])

  // Reload plans whose viewUrl has expired so the grid stays showing fresh images.
  const refreshExpired = useCallback(() => {
    if (!remote.data) return
    const hasExpired = remote.data.some((p) => p.completedAt && viewUrlExpired(p.viewUrlExpiresAt))
    if (hasExpired) remote.reload()
  }, [remote])

  useEffect(() => {
    const id = setInterval(refreshExpired, 10_000)
    return () => clearInterval(id)
  }, [refreshExpired])

  if (!hasPermission(access, 'VIEW_PLAN')) {
    return (
      <div className="page">
        <Notice tone="error">{m.workspace.forbidden}</Notice>
      </div>
    )
  }

  async function handleDelete(plan: Plan) {
    if (!confirm(t.deleteTitle)) return
    setDeletingId(plan.id)
    try {
      await deletePlan(org.id, siteId, plan.id)
      remote.update((plans) => plans.filter((p) => p.id !== plan.id))
    } catch {
      // deletion failed — plan stays in the list
    } finally {
      setDeletingId(null)
    }
  }

  function handleUploaded(plan: Plan) {
    setUploadOpen(false)
    remote.update((plans) => [plan, ...plans])
  }

  return (
    <div className="page">
      <BackLink to={`/sites/${encodeURIComponent(siteId)}/plans`}>{t.back}</BackLink>
      <header className="page-header">
        <div className="page-header__text">
          <h1>{title}</h1>
          <p className="page-header__description">{t.description}</p>
        </div>
        {canManage && (
          <div className="page-header__actions">
            <button className="button button--primary" type="button" onClick={() => setUploadOpen(true)}>
              {t.upload}
            </button>
          </div>
        )}
      </header>

      {remote.status === 'loading' && <LoadingState label={t.loading} />}
      {remote.status === 'error' && (
        <Notice tone="error" action={{ label: t.retry, onClick: remote.reload }}>
          {t.loadError}
        </Notice>
      )}
      {remote.status === 'ready' && remote.data && (
        remote.data.length > 0 ? (
          <ul className="plan-grid">
            {remote.data.map((plan) => (
              <li key={plan.id} className="plan-card">
                <div className="plan-card__image-wrap">
                  {plan.completedAt && plan.viewUrl && !viewUrlExpired(plan.viewUrlExpiresAt) ? (
                    <img
                      className="plan-card__image"
                      src={plan.viewUrl}
                      alt={plan.name || plan.fileName}
                    />
                  ) : (
                    <div className="plan-card__placeholder" />
                  )}
                </div>
                <div className="plan-card__info">
                  <span className="plan-card__name">{plan.name || plan.fileName}</span>
                  {plan.description && (
                    <span className="plan-card__description">{plan.description}</span>
                  )}
                </div>
                {canManage && (
                  <button
                    className="button button--ghost plan-card__delete"
                    type="button"
                    disabled={deletingId === plan.id}
                    onClick={() => handleDelete(plan)}
                  >
                    {t.delete}
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-state">
            <p className="empty-state__title">{t.emptyTitle}</p>
            <p>{canManage ? t.emptyBody : t.emptyBodyReadOnly}</p>
            {canManage && (
              <button className="button button--primary" type="button" onClick={() => setUploadOpen(true)}>
                {t.uploadFirst}
              </button>
            )}
          </div>
        )
      )}

      {uploadOpen && (
        <PlanUploadDialog
          organizationId={org.id}
          siteId={siteId}
          folderId={folderId}
          onUploaded={handleUploaded}
          onClose={() => setUploadOpen(false)}
        />
      )}
    </div>
  )
}
