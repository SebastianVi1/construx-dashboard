import { NavLink, useMatch } from 'react-router'
import { FolderIcon } from '../../components/icons'
import { useRemoteData } from '../../components/data/useRemoteData'
import { useLocale, type Locale } from '../../i18n'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { getDocumentFolders, type DocumentFolder } from './documentFoldersApi'
import './documents.css'

function folderName(folder: DocumentFolder, locale: Locale) {
  return locale === 'es' ? folder.nameEs : folder.nameEn
}

/** Collapsible list of document folders for the site currently open under /documents/sites/:siteId. */
export function DocumentsNavTree() {
  const { messages: m, locale } = useLocale()
  const org = useCurrentOrganization()
  const match = useMatch('/documents/sites/:siteId/*')
  const siteId = match?.params.siteId ?? null
  const remote = useRemoteData(
    siteId ? `${org.id}:${siteId}:doc-folders` : null,
    () => getDocumentFolders(org.id, siteId!),
  )

  if (!siteId || !remote.data?.length) return null

  return (
    <ul className="documents-nav-tree" aria-label={m.documents.foldersLabel}>
      {remote.data.map((folder) => (
        <li key={folder.id}>
          <NavLink
            className="documents-nav-tree__link"
            to={`/documents/sites/${encodeURIComponent(siteId)}/folders/${encodeURIComponent(folder.id)}`}
            title={folderName(folder, locale)}
          >
            <FolderIcon className="documents-nav-tree__icon" />
            <span className="documents-nav-tree__name">{folderName(folder, locale)}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  )
}
