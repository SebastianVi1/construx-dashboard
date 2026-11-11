import { DocumentFoldersSkeleton } from '../documents/DocumentSkeletons'
import '../documents/documents.css'
import { useEffect } from 'react'
import { Link, useParams } from 'react-router'
import { FolderIcon } from '../../components/icons'
import { useRemoteData } from '../../components/data/useRemoteData'
import { NameForm, TEXT_LIMITS } from '../../components/form'
import { ConfirmDialog } from '../../components/modal'
import { BackLink, Notice } from '../../components/page'
import { useLocale, type Locale } from '../../i18n'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { usePermissions } from '../permissions'
import { hasPermission } from '../permissions/landing'
import {
  createDocumentFolder,
  deleteDocumentFolder,
  getDocumentFolders,
  type DocumentFolder,
} from '../documents/documentFoldersApi'
import { useState } from 'react'

function folderName(folder: DocumentFolder, locale: Locale) {
  return locale === 'es' ? folder.nameEs : folder.nameEn
}

/** Folder grid for one site's plans (uses shared document-folder tree). */
export function SitePlansPage() {
  const { siteId = '' } = useParams()
  const { messages: m, locale } = useLocale()
  const t = m.plans
  const td = m.documents
  const org = useCurrentOrganization()
  const { access, can } = usePermissions()
  const canManage = can('MANAGE_PROJECT', siteId)
  const remote = useRemoteData(`${org.id}:${siteId}:doc-folders`, () => getDocumentFolders(org.id, siteId))

  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [deletingFolder, setDeletingFolder] = useState<DocumentFolder | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    document.title = `${t.title} | Construx`
  }, [t.title])

  if (!hasPermission(access, 'VIEW_PLAN')) {
    return (
      <div className="page">
        <Notice tone="error">{m.workspace.forbidden}</Notice>
      </div>
    )
  }

  async function handleDeleteFolder(folder: DocumentFolder) {
    try {
      await deleteDocumentFolder(org.id, siteId, folder.id)
      remote.update((folders) => folders.filter((f) => f.id !== folder.id))
      setDeletingFolder(null)
    } catch {
      setDeleteError(td.deleteFolderError)
    }
  }

  async function handleCreate(name: string) {
    setCreateError(null)
    try {
      const folder = await createDocumentFolder(org.id, siteId, name, name)
      remote.update((folders) => [...folders, folder])
      setCreating(false)
    } catch (error) {
      setCreateError(td.createError)
      throw error
    }
  }

  return (
    <div className="page documents-page">
      <BackLink to={`/sites/${encodeURIComponent(siteId)}`}>{m.workspace.sites}</BackLink>
      <header className="page-header">
        <div className="page-header__text">
          <h1>{t.title}</h1>
          <p className="page-header__description">{t.foldersDescription}</p>
        </div>
        {canManage && (
          <div className="page-header__actions">
            <button className="button button--secondary" type="button" onClick={() => setCreating(true)}>
              {td.newFolder}
            </button>
          </div>
        )}
      </header>

      {creating && (
        <NameForm
          label={td.folderName}
          maxLength={TEXT_LIMITS.folderName}
          messages={{ required: td.folderNameRequired, max: td.folderNameMax }}
          submitLabel={td.create}
          pendingLabel={td.creating}
          cancelLabel={td.cancel}
          error={createError}
          onSubmit={handleCreate}
          onCancel={() => {
            setCreating(false)
            setCreateError(null)
          }}
        />
      )}

      {deletingFolder && (
        <ConfirmDialog
          title={td.deleteFolder}
          body={td.deleteFolderConfirm}
          confirmLabel={td.deleteFolder}
          pendingLabel={td.deleting}
          cancelLabel={td.cancel}
          error={deleteError}
          onConfirm={() => handleDeleteFolder(deletingFolder)}
          onClose={() => setDeletingFolder(null)}
        />
      )}

      {remote.status === 'loading' && !remote.data && <DocumentFoldersSkeleton />}
      {remote.status === 'error' && (
        <Notice tone="error" action={{ label: t.retry, onClick: remote.reload }}>
          {t.loadError}
        </Notice>
      )}
      {remote.data !== undefined && remote.status !== 'error' && remote.data && (
        remote.data.length > 0 ? (
          <ul className="document-folders-grid">
            {remote.data.map((folder) => (
              <li key={folder.id} className="document-folder-card-item">
                <Link
                  className="document-folder-card"
                  to={`/sites/${encodeURIComponent(siteId)}/plans/folders/${encodeURIComponent(folder.id)}`}
                >
                  <div className="document-folder-card__icon-wrap">
                    <FolderIcon className="document-folder-card__icon" />
                  </div>
                  <span className="document-folder-card__name">{folderName(folder, locale)}</span>
                  <span className="document-folder-card__count">
                    {folder.entryCount === 1
                      ? td.oneFile
                      : `${folder.entryCount} ${td.files}`}
                  </span>
                </Link>
                {canManage && !folder.standard && (
                  <button
                    className="button button--ghost document-folder-card__delete-btn"
                    type="button"
                    onClick={() => {
                      setDeleteError(null)
                      setDeletingFolder(folder)
                    }}
                  >
                    {td.deleteFolder}
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>{td.noFolders}</p>
        )
      )}
    </div>
  )
}
