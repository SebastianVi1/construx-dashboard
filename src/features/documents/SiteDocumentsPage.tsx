import { DocumentFoldersSkeleton, DocumentEntriesSkeleton } from './DocumentSkeletons'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { FolderIcon, SearchIcon } from '../../components/icons'
import { useRemoteData } from '../../components/data/useRemoteData'
import { NameForm, TEXT_LIMITS } from '../../components/form'
import { ConfirmDialog } from '../../components/modal'
import { BackLink, SkeletonBlock, Notice } from '../../components/page'
import { useLocale, type Locale } from '../../i18n'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { usePermissions } from '../permissions'
import { getSite } from '../sites/sitesApi'
import {
  createDocumentFolder,
  deleteDocumentFolder,
  getDocumentFolders,
  searchDocuments,
  type DocumentFolder,
  type DocumentSearchHit,
} from './documentFoldersApi'
import './documents.css'

function folderName(folder: DocumentFolder, locale: Locale) {
  return locale === 'es' ? folder.nameEs : folder.nameEn
}


/** Folder grid for one site's documents. */
export function SiteDocumentsPage() {
  const { siteId = '' } = useParams()
  const { messages: m, locale } = useLocale()
  const t = m.documents
  const org = useCurrentOrganization()
  const { can } = usePermissions()
  const canManage = can('MANAGE_PROJECT', siteId)
  const navigate = useNavigate()
  const site = useRemoteData(`${org.id}:${siteId}:site`, () => getSite(org.id, siteId))
  const remote = useRemoteData(`${org.id}:${siteId}:doc-folders`, () => getDocumentFolders(org.id, siteId))

  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [deletingFolder, setDeletingFolder] = useState<DocumentFolder | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Search
  const [query, setQuery] = useState('')
  const [searchHits, setSearchHits] = useState<DocumentSearchHit[] | null>(null)
  const [searching, setSearching] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const name = site.data?.name ?? t.pageTitle
    document.title = `${name} · ${m.workspace.documents} | Construx`
  }, [site.data?.name, t.pageTitle, m.workspace.documents])

  function handleQueryChange(value: string) {
    setQuery(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!value.trim()) { setSearchHits(null); return }
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const hits = await searchDocuments(org.id, siteId, value.trim())
        setSearchHits(hits)
      } catch {
        setSearchHits([])
      } finally {
        setSearching(false)
      }
    }, 300)
  }

  function folderNameForHit(hit: DocumentSearchHit) {
    return locale === 'es' ? hit.folderNameEs : hit.folderNameEn
  }

  async function handleDeleteFolder(folder: DocumentFolder) {
    try {
      await deleteDocumentFolder(org.id, siteId, folder.id)
      remote.update((folders) => folders.filter((f) => f.id !== folder.id))
      setDeletingFolder(null)
    } catch {
      setDeleteError(t.deleteFolderError)
    }
  }

  async function handleCreate(name: string) {
    setCreateError(null)
    try {
      const folder = await createDocumentFolder(org.id, siteId, name, name)
      remote.update((folders) => [...folders, folder])
      setCreating(false)
    } catch (error) {
      setCreateError(t.createError)
      throw error
    }
  }

  return (
    <div className="page documents-page">
      <BackLink to="/documents">{m.workspace.documents}</BackLink>
      <header className="page-header">
        <div className="page-header__text">
          <h1>{site.status === 'loading' && !site.data ? <span role="status" aria-label={m.workspace.loading}><SkeletonBlock width="min(240px, 60vw)" height={36} /></span> : site.data?.name ?? m.workspace.documents}</h1>
          <p className="page-header__description">{t.foldersDescription}</p>
        </div>
        {canManage && (
          <div className="page-header__actions">
            <button className="button button--secondary" type="button" onClick={() => setCreating(true)}>
              {t.newFolder}
            </button>
          </div>
        )}
      </header>

      <div className="document-search">
        <SearchIcon className="document-search__icon" />
        <input
          className="document-search__input"
          type="search"
          placeholder={t.searchPlaceholder}
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          aria-label={t.searchPlaceholder}
        />
      </div>

      {creating && (
        <NameForm
          label={t.folderName}
          maxLength={TEXT_LIMITS.folderName}
          messages={{ required: t.folderNameRequired, max: t.folderNameMax }}
          submitLabel={t.create}
          pendingLabel={t.creating}
          cancelLabel={t.cancel}
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
          title={t.deleteFolder}
          body={t.deleteFolderConfirm}
          confirmLabel={t.deleteFolder}
          pendingLabel={t.deleting}
          cancelLabel={t.cancel}
          error={deleteError}
          onConfirm={() => handleDeleteFolder(deletingFolder)}
          onClose={() => setDeletingFolder(null)}
        />
      )}

      {/* Search results */}
      {query.trim() && (
        <section className="document-search-results">
          <h2 className="document-search-results__title">{t.searchResults}</h2>
          {searching && <DocumentEntriesSkeleton search />}
          {!searching && searchHits !== null && (
            searchHits.length > 0 ? (
              <ul className="document-entries-list">
                {searchHits.map((hit) => (
                  <div
                    key={hit.entryId}
                    className="document-entry document-entry--clickable"
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/documents/sites/${encodeURIComponent(siteId)}/folders/${encodeURIComponent(hit.folderId)}`)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/documents/sites/${encodeURIComponent(siteId)}/folders/${encodeURIComponent(hit.folderId)}`) }}
                  >
                    <span className="document-entry__name" title={hit.fileName}>{hit.fileName}</span>
                    <span className="document-entry__meta">{t.inFolder}: {folderNameForHit(hit)}</span>
                  </div>
                ))}
              </ul>
            ) : (
              <p>{t.noSearchResults}</p>
            )
          )}
        </section>
      )}

      {/* Folder grid (hidden while searching) */}
      {!query.trim() && (
        <>
          {remote.status === 'loading' && !remote.data && <DocumentFoldersSkeleton />}
          {remote.status === 'error' && (
            <Notice tone="error" action={{ label: m.workspace.retry, onClick: remote.reload }}>
              {t.loadFoldersError}
            </Notice>
          )}
          {remote.data !== undefined && remote.status !== 'error' && remote.data && (
            remote.data.length > 0 ? (
              <ul className="document-folders-grid">
                {remote.data.map((folder) => (
                  <li key={folder.id} className="document-folder-card-item">
                    <Link
                      className="document-folder-card"
                      to={`/documents/sites/${encodeURIComponent(siteId)}/folders/${encodeURIComponent(folder.id)}`}
                    >
                      <div className="document-folder-card__icon-wrap">
                        <FolderIcon className="document-folder-card__icon" />
                      </div>
                      <span className="document-folder-card__name">{folderName(folder, locale)}</span>
                      <span className="document-folder-card__count">
                        {folder.entryCount === 1
                          ? t.oneFile
                          : `${folder.entryCount} ${t.files}`}
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
                        {t.deleteFolder}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p>{t.noFolders}</p>
            )
          )}
        </>
      )}

    </div>
  )
}
