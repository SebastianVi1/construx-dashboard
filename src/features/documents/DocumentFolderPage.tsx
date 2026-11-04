import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useRemoteData } from '../../components/data/useRemoteData'
import { LoadingState, Notice } from '../../components/page'
import { useLocale, type Locale } from '../../i18n'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { usePermissions } from '../permissions'
import {
  confirmUpload,
  deleteDocumentEntry,
  getDocumentEntries,
  getDocumentFolders,
  requestUploadUrl,
  type DocumentEntry,
  type DocumentFolder,
} from './documentFoldersApi'
import './documents.css'

function folderName(folder: DocumentFolder, locale: Locale) {
  return locale === 'es' ? folder.nameEs : folder.nameEn
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : 'en-US', {
      dateStyle: 'medium',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

/** File list and upload for one document folder. */
export function DocumentFolderPage() {
  const { siteId = '', folderId = '' } = useParams()
  const { messages: m, locale } = useLocale()
  const t = m.documents
  const org = useCurrentOrganization()
  const { can } = usePermissions()
  const canManage = can('MANAGE_PROJECT', siteId)

  const foldersRemote = useRemoteData(
    `${org.id}:${siteId}:doc-folders`,
    () => getDocumentFolders(org.id, siteId),
  )
  const folder = foldersRemote.data?.find((f) => f.id === folderId)

  const entriesRemote = useRemoteData(
    `${org.id}:${siteId}:${folderId}:entries`,
    () => getDocumentEntries(org.id, siteId, folderId),
  )

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    const name = folder ? folderName(folder, locale) : t.folderTitle
    document.title = `${name} · ${m.workspace.documents} | Construx`
  }, [folder, locale, t.folderTitle, m.workspace.documents])

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    setUploading(true)
    try {
      const urlData = await requestUploadUrl(org.id, siteId, folderId, file.name, file.type || 'application/octet-stream', file.size)
      await fetch(urlData.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream', ...urlData.headers },
        body: file,
      })
      const entry = await confirmUpload(org.id, siteId, folderId, urlData.entryId, urlData.s3Key, file.name, file.size, file.type || null)
      entriesRemote.update((entries) => [entry, ...entries])
    } catch {
      setUploadError(t.uploadError)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDelete(entry: DocumentEntry) {
    if (!confirm(t.deleteConfirm)) return
    try {
      await deleteDocumentEntry(org.id, siteId, folderId, entry.id)
      entriesRemote.update((entries) => entries.filter((e) => e.id !== entry.id))
    } catch {
      // non-blocking: user can retry
    }
  }

  const displayName = folder ? folderName(folder, locale) : t.folderTitle

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__text">
          <h1>{displayName}</h1>
        </div>
        {canManage && (
          <div className="page-header__actions">
            <input
              ref={fileInputRef}
              type="file"
              className="visually-hidden"
              onChange={handleFileSelect}
              aria-label={t.uploadFile}
            />
            <button
              className="button button--primary"
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? t.uploading : t.uploadFile}
            </button>
          </div>
        )}
      </header>

      {uploadError && (
        <Notice tone="error">{uploadError}</Notice>
      )}

      {entriesRemote.status === 'loading' && <LoadingState label={t.loadingFiles} />}
      {entriesRemote.status === 'error' && (
        <Notice tone="error" action={{ label: m.workspace.retry, onClick: entriesRemote.reload }}>
          {t.loadFilesError}
        </Notice>
      )}
      {entriesRemote.status === 'ready' && (
        entriesRemote.data && entriesRemote.data.length > 0 ? (
          <div className="document-entries-list">
            {entriesRemote.data.map((entry) => (
              <div key={entry.id} className="document-entry">
                <span className="document-entry__name" title={entry.fileName}>{entry.fileName}</span>
                <span className="document-entry__meta">
                  {formatBytes(entry.fileSize)}{entry.fileSize ? ' · ' : ''}{formatDate(entry.createdAt, locale)}
                </span>
                <div className="document-entry__actions">
                  <a
                    className="button button--ghost button--sm"
                    href={entry.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t.download}
                  </a>
                  {canManage && (
                    <button
                      className="button button--ghost button--sm button--danger"
                      type="button"
                      onClick={() => handleDelete(entry)}
                    >
                      {t.delete}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>{t.noFiles}</p>
        )
      )}

      <p style={{ marginTop: 16 }}>
        <Link to={`/documents/sites/${encodeURIComponent(siteId)}`}>
          ← {t.backToFolders}
        </Link>
      </p>
    </div>
  )
}
