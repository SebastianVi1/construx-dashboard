import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { FolderIcon } from '../../components/icons'
import { ConfirmDialog, Modal } from '../../components/modal'
import { LoadingState, Notice } from '../../components/page'
import { formatMessage, useLocale } from '../../i18n'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { usePermissions } from '../permissions'
import { hasPermission, landingPath } from '../permissions/landing'
import { PlanUploadDialog } from './PlanUploadDialog'
import { deletePlan, type Plan } from './plansApi'
import { deletePlanFolder, movePlan, savePlanFolder, type PlanFolder, type PlanLibrary } from './planLibraryApi'
import { usePlanLibrary } from './planLibraryContext'
import { folderOptions, folderPath, planFolderHref, plansInFolder } from './planTree'
import { PlanLibraryForm } from './PlanLibraryDialogs'
import { megabytes, viewUrlExpired } from './planDisplay'
import './plans.css'

type Dialog = { kind: 'folder'; folder: PlanFolder | null } | { kind: 'deleteFolder'; folder: PlanFolder }
  | { kind: 'site' } | { kind: 'upload'; siteId: string } | { kind: 'view' | 'move' | 'deletePlan'; id: string } | null

export function PlanLibraryPage() {
  const { folderId } = useParams()
  const { access } = usePermissions()
  const remote = usePlanLibrary()
  const { messages: m } = useLocale()
  if (!hasPermission(access, 'VIEW_PLAN')) return <Navigate to={landingPath(access)} replace />
  if (!remote.data) return <div className="page">{remote.status === 'error'
    ? <Notice tone="error" action={{ label: m.plans.retry, onClick: remote.reload }}>{m.plans.loadError}</Notice>
    : <LoadingState label={m.plans.loading} />}</div>
  return <Library key={folderId ?? 'root'} data={remote.data} folderId={folderId ?? null} />
}

function Library({ data, folderId }: { data: PlanLibrary; folderId: string | null }) {
  const { messages: m } = useLocale()
  const t = m.plans
  const c = t.library
  const org = useCurrentOrganization()
  const remote = usePlanLibrary()
  const navigate = useNavigate()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [site, setSite] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const current = data.folders.find(folder => folder.id === folderId)
  const children = data.folders.filter(folder => folder.parentId === folderId)
  const visiblePlans = plansInFolder(data.plans, folderId).filter(plan => !site || plan.projectId === site)
  const writableSites = data.sites.filter(item => item.canManage)
  const selected = dialog && 'id' in dialog ? data.plans.find(plan => plan.id === dialog.id) : undefined
  const canManage = (plan: Plan) => data.sites.some(item => item.id === plan.projectId && item.canManage)
  const close = () => { setDialog(null); setError(null) }
  const saved = () => { close(); remote.reload() }
  const refreshExpired = (plan: Plan) => { if (viewUrlExpired(plan.viewUrlExpiresAt)) remote.reload() }

  if (folderId && !current) return <div className="page"><Notice tone="error">{c.missing}</Notice><Link to="/plans">{t.title}</Link></div>

  return <div className="page plans-library">
    <header className="page-header">
      <div><h1>{t.title}</h1><p>{c.description}</p></div>
      <div className="button-row">
        {data.canManageFolders ? <button className="button" type="button" onClick={() => setDialog({ kind: 'folder', folder: null })}>{c.newFolder}</button> : null}
        {writableSites.length ? <button className="button button--primary" type="button" onClick={() => setDialog({ kind: 'site' })}>{t.upload}</button> : null}
      </div>
    </header>
    {notice ? <Notice tone="success">{notice}</Notice> : null}
    {remote.status === 'error' ? <Notice tone="error" action={{ label: t.retry, onClick: remote.reload }}>{t.loadError}</Notice> : null}
    <nav className="plans-breadcrumb" aria-label={m.workspace.breadcrumb}>
      <Link to="/plans">{c.root}</Link>
      {folderPath(data.folders, folderId).map(folder => <Link key={folder.id} to={planFolderHref(folder.id)} aria-current={folder.id === folderId ? 'page' : undefined}>{folder.name}</Link>)}
    </nav>
    <div className="plans-library__toolbar">
      <h2>{current?.name ?? c.root}</h2>
      {current && data.canManageFolders ? <div className="button-row">
        <button className="button" type="button" onClick={() => setDialog({ kind: 'folder', folder: current })}>{c.editFolder}</button>
        <button className="button" type="button" onClick={() => setDialog({ kind: 'deleteFolder', folder: current })}>{c.deleteFolder}</button>
      </div> : null}
      <label className="plans-site-filter">{c.site}<select className="form-field__control" value={site} onChange={e => setSite(e.target.value)}>
        <option value="">{c.allSites}</option>{data.sites.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
    </div>
    {children.length ? <ul className="plans-folder-list" aria-label={c.folders}>
      {children.map(folder => <li key={folder.id}><Link to={planFolderHref(folder.id)}><FolderIcon /><span>{folder.name}</span></Link></li>)}
    </ul> : null}
    {visiblePlans.length === 0 ? <p className="empty-state">{c.empty}</p> : <ul className="site-plans__grid">
      {visiblePlans.map(plan => <li key={plan.id}>
        <button className="plan-card" type="button" aria-label={formatMessage(t.open, { name: plan.name })} onClick={() => setDialog({ kind: 'view', id: plan.id })}>
          <span className="plan-card__thumb">{plan.viewUrl ? <img src={plan.viewUrl} alt="" loading="lazy" onError={() => refreshExpired(plan)} /> : null}</span>
          <span className="plan-card__name">{plan.name}</span>
          <span className="plan-card__meta">{data.sites.find(item => item.id === plan.projectId)?.name}</span>
          <span className="plan-card__meta data-mono">{formatMessage(t.size, { size: megabytes(plan.sizeBytes) })}</span>
        </button>
      </li>)}
    </ul>}
    {dialog?.kind === 'folder' ? <PlanLibraryForm title={dialog.folder ? c.editFolder : c.newFolder} nameRequired
      initialValues={{ name: dialog.folder?.name ?? '', parent: dialog.folder ? dialog.folder.parentId ?? '' : folderId ?? '' }}
      fields={[{ name: 'name', label: c.name }, { name: 'parent', label: c.parent, type: 'select', options: folderOptions(data.folders, c.noParent, dialog.folder?.id) }]}
      onClose={close} onSave={async values => { await savePlanFolder(org.id, dialog.folder?.id ?? null, values.name.trim(), values.parent || null); saved() }} /> : null}
    {dialog?.kind === 'deleteFolder' ? <ConfirmDialog title={c.deleteFolder} body={c.deleteBody} confirmLabel={t.deleteConfirm} pendingLabel={t.deleting}
      cancelLabel={t.dialog.cancel} error={error} onClose={close} onConfirm={async () => {
        try { await deletePlanFolder(org.id, dialog.folder.id); navigate(planFolderHref(dialog.folder.parentId)); saved() }
        catch { setError(c.failed) }
      }} /> : null}
    {dialog?.kind === 'site' ? <PlanLibraryForm title={c.chooseSite}
      initialValues={{ site: writableSites.find(item => item.id === site)?.id ?? writableSites[0]?.id ?? '' }}
      fields={[{ name: 'site', label: c.site, type: 'select', options: writableSites.map(item => ({ value: item.id, label: item.name })) }]}
      onClose={close} onSave={async values => { if (writableSites.some(item => item.id === values.site)) setDialog({ kind: 'upload', siteId: values.site }) }} /> : null}
    {dialog?.kind === 'upload' ? <PlanUploadDialog organizationId={org.id} siteId={dialog.siteId} onClose={close} onUploaded={plan => {
      close()
      // Completion already persisted the upload; a failed move must never invite a duplicate upload.
      void (async () => {
        try { if (folderId) await movePlan(org.id, plan.projectId, plan.id, folderId); setNotice(t.uploaded) }
        catch { setNotice(c.uploadedAtRoot) }
        finally { remote.reload() }
      })()
    }} /> : null}
    {dialog?.kind === 'view' && selected ? <Modal title={selected.name} description={data.sites.find(item => item.id === selected.projectId)?.name} onClose={close}>
      {selected.viewUrl ? <img className="plan-viewer__image" src={selected.viewUrl} alt={selected.name} onError={() => refreshExpired(selected)} /> : null}
      {selected.description ? <p>{selected.description}</p> : null}
      <div className="button-row modal-actions">
        {canManage(selected) ? <>
          <button className="button" type="button" onClick={() => setDialog({ kind: 'move', id: selected.id })}>{c.move}</button>
          <button className="button button--danger" type="button" onClick={() => setDialog({ kind: 'deletePlan', id: selected.id })}>{t.delete}</button>
        </> : null}
        {selected.viewUrl ? <a className="button" href={selected.viewUrl} target="_blank" rel="noreferrer">{t.openOriginal}</a> : null}
        <button className="button" type="button" onClick={close}>{t.close}</button>
      </div>
    </Modal> : null}
    {dialog?.kind === 'move' && selected && canManage(selected) ? <PlanLibraryForm title={c.move}
      initialValues={{ folder: selected.folderId ?? '' }}
      fields={[{ name: 'folder', label: c.destination, type: 'select', options: folderOptions(data.folders, c.noParent) }]}
      onClose={close} onSave={async values => { await movePlan(org.id, selected.projectId, selected.id, values.folder || null); saved() }} /> : null}
    {dialog?.kind === 'deletePlan' && selected && canManage(selected) ? <ConfirmDialog title={t.deleteTitle} body={formatMessage(t.deleteBody, { name: selected.name })}
      confirmLabel={t.deleteConfirm} pendingLabel={t.deleting} cancelLabel={t.dialog.cancel} error={error} onClose={close}
      onConfirm={async () => { try { await deletePlan(org.id, selected.projectId, selected.id); saved() } catch { setError(c.failed) } }} /> : null}
  </div>
}
