import { useState } from 'react'
import { useRemoteData } from '../../components/data/useRemoteData'
import { ConfirmDialog, Modal } from '../../components/modal'
import { LoadingState, Notice } from '../../components/page'
import { formatMessage, useLocale } from '../../i18n'
import { PlanUploadDialog } from './PlanUploadDialog'
import { megabytes, viewUrlExpired } from './planDisplay'
import { deletePlan, listPlans, planErrorKind, type Plan } from './plansApi'
import './plans.css'

type SitePlansProps = {
  organizationId: string
  siteId: string
  /** MANAGE_PLAN: upload and delete. Render this section only with VIEW_PLAN. */
  canManage: boolean
  onNotice: (notice: string) => void
}

type Dialog = { kind: 'upload' } | { kind: 'view'; plan: Plan } | { kind: 'delete'; plan: Plan } | null

/** The site's plans as a grid of thumbnails; click one to see it large. */
export function SitePlans({ organizationId, siteId, canManage, onNotice }: SitePlansProps) {
  const { messages: m } = useLocale()
  const t = m.plans
  const plans = useRemoteData(`${organizationId}:${siteId}:plans`, () => listPlans(organizationId, siteId))
  const [dialog, setDialog] = useState<Dialog>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function close() {
    setDialog(null)
    setDeleteError(null)
  }

  /** View links last a few minutes; a broken image after that asks for fresh ones. */
  function refreshIfExpired(plan: Plan) {
    if (viewUrlExpired(plan.viewUrlExpiresAt)) plans.reload()
  }

  return (
    <section className="page-section site-plans" aria-labelledby="site-plans-heading">
      <div className="page-section__header">
        <div>
          <h2 id="site-plans-heading">{t.title}</h2>
          <p>{t.description}</p>
        </div>
        {canManage && plans.data && plans.data.length > 0 ? (
          <button type="button" className="button button--primary" onClick={() => setDialog({ kind: 'upload' })}>
            {t.upload}
          </button>
        ) : null}
      </div>

      {plans.status === 'error' && !plans.data ? (
        <Notice tone="error" action={{ label: t.retry, onClick: plans.reload }}>
          {t.loadError}
        </Notice>
      ) : !plans.data ? (
        <LoadingState label={t.loading} />
      ) : plans.data.length === 0 ? (
        <div className="empty-state">
          <h3 className="site-plans__empty-title">{t.emptyTitle}</h3>
          <p>{canManage ? t.emptyBody : t.emptyBodyReadOnly}</p>
          {canManage ? (
            <button type="button" className="button button--primary" onClick={() => setDialog({ kind: 'upload' })}>
              {t.uploadFirst}
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="site-plans__grid">
          {plans.data.map((plan) => (
            <li key={plan.id}>
              <button
                type="button"
                className="plan-card"
                aria-label={formatMessage(t.open, { name: plan.name })}
                onClick={() => setDialog({ kind: 'view', plan })}
              >
                <span className="plan-card__thumb">
                  {plan.viewUrl ? (
                    <img src={plan.viewUrl} alt="" loading="lazy" onError={() => refreshIfExpired(plan)} />
                  ) : null}
                </span>
                <span className="plan-card__name">{plan.name}</span>
                <span className="plan-card__meta data-mono">{formatMessage(t.size, { size: megabytes(plan.sizeBytes) })}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {dialog?.kind === 'upload' ? (
        <PlanUploadDialog
          organizationId={organizationId}
          siteId={siteId}
          onClose={close}
          onUploaded={(plan) => {
            close()
            plans.update((current) => [plan, ...current])
            onNotice(t.uploaded)
          }}
        />
      ) : null}
      {dialog?.kind === 'view' ? (
        <Modal title={dialog.plan.name} description={dialog.plan.description ?? undefined} onClose={close}>
          {dialog.plan.viewUrl ? (
            <img
              className="plan-viewer__image"
              src={dialog.plan.viewUrl}
              alt={dialog.plan.name}
              onError={() => refreshIfExpired(dialog.plan)}
            />
          ) : null}
          <div className="button-row button-row--end modal-actions">
            {canManage ? (
              <button type="button" className="button button--danger" onClick={() => setDialog({ kind: 'delete', plan: dialog.plan })}>
                {t.delete}
              </button>
            ) : null}
            {dialog.plan.viewUrl ? (
              <a className="button" href={dialog.plan.viewUrl} target="_blank" rel="noreferrer">
                {t.openOriginal}
              </a>
            ) : null}
            <button type="button" className="button" onClick={close}>
              {t.close}
            </button>
          </div>
        </Modal>
      ) : null}
      {dialog?.kind === 'delete' ? (
        <ConfirmDialog
          title={t.deleteTitle}
          body={formatMessage(t.deleteBody, { name: dialog.plan.name })}
          confirmLabel={t.deleteConfirm}
          pendingLabel={t.deleting}
          cancelLabel={t.dialog.cancel}
          error={deleteError}
          onClose={close}
          onConfirm={async () => {
            const removed = dialog.plan
            try {
              await deletePlan(organizationId, siteId, removed.id)
              close()
              plans.update((current) => current.filter((plan) => plan.id !== removed.id))
              onNotice(t.deleted)
            } catch (failure) {
              setDeleteError(t.error[planErrorKind(failure)])
            }
          }}
        />
      ) : null}
    </section>
  )
}
