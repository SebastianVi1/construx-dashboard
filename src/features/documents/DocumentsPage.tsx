import { DocumentFoldersSkeleton } from './DocumentSkeletons'
import { useEffect } from 'react'
import { Link } from 'react-router'
import { FolderIcon } from '../../components/icons'
import { useRemoteData } from '../../components/data/useRemoteData'
import { Notice } from '../../components/page'
import { useLocale } from '../../i18n'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { listSites } from '../sites/sitesApi'
import './documents.css'

/** Entry point for the Documents section: pick a site to view its folders. */
export function DocumentsPage() {
  const { messages: m } = useLocale()
  const t = m.documents
  const org = useCurrentOrganization()
  const sites = useRemoteData(`${org.id}:sites`, () => listSites(org.id))

  useEffect(() => {
    document.title = `${m.workspace.documents} | Construx`
  }, [m.workspace.documents])

  return (
    <div className="page documents-page">
      <header className="page-header">
        <div className="page-header__text">
          <h1>{m.workspace.documents}</h1>
          <p className="page-header__description">{t.pageDescription}</p>
        </div>
      </header>

      {sites.status === 'loading' && !sites.data && <DocumentFoldersSkeleton />}
      {sites.status === 'error' && (
        <Notice tone="error" action={{ label: m.workspace.retry, onClick: sites.reload }}>
          {t.loadSitesError}
        </Notice>
      )}
      {sites.data !== undefined && sites.status !== 'error' && (
        sites.data && sites.data.length > 0 ? (
          <ul className="document-folders-grid">
            {sites.data.map((site) => (
              <li key={site.id}>
                <Link
                  className="document-folder-card"
                  to={`/documents/sites/${encodeURIComponent(site.id)}`}
                >
                  <div className="document-folder-card__icon-wrap">
                    <FolderIcon className="document-folder-card__icon" />
                  </div>
                  <span className="document-folder-card__name">{site.name}</span>
                  <span className="document-folder-card__count">{t.viewFolders}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>{t.noSites}</p>
        )
      )}
    </div>
  )
}
