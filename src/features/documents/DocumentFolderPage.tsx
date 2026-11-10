import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useRemoteData } from '../../components/data/useRemoteData'
import { ConfirmDialog } from '../../components/modal'
import { BackLink, SkeletonList, Notice } from '../../components/page'
import { useLocale, type Locale } from '../../i18n'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { usePermissions } from '../permissions'
import { downloadPresigned } from '../../lib/http'
import {
  deleteDocumentEntry,
  getDocumentEntries,
  getDocumentFolders,
  uploadDocumentFile,
  type DocumentEntry,
  type DocumentFolder,
} from './documentFoldersApi'
import './documents.css'

function folderName(folder: DocumentFolder, locale: Locale) {
  return locale === 'es' ? folder.nameEs : folder.nameEn
}

function isImageFile(entry: DocumentEntry): boolean {
  return !!entry.fileType?.startsWith('image/')
}

function isPdfFile(entry: DocumentEntry): boolean {
  return (
    entry.fileType === 'application/pdf' ||
    entry.fileName.toLowerCase().endsWith('.pdf')
  )
}

function isExcelFile(entry: DocumentEntry): boolean {
  if (entry.fileType) {
    return (
      entry.fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      entry.fileType === 'application/vnd.ms-excel' ||
      entry.fileType === 'text/csv'
    )
  }
  const ext = entry.fileName.split('.').pop()?.toLowerCase() ?? ''
  return ext === 'xlsx' || ext === 'xls' || ext === 'csv'
}

/** Save a presigned file locally. Throws ApiError when storage refuses it (e.g. expired link). */
async function downloadFile(url: string, fileName: string): Promise<void> {
  const blob = await downloadPresigned(url)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(a.href)
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
  const navigate = useNavigate()
  const [previewEntry, setPreviewEntry] = useState<DocumentEntry | null>(null)

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
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<DocumentEntry | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    const name = folder ? folderName(folder, locale) : t.folderTitle
    document.title = `${name} · ${m.workspace.documents} | Construx`
  }, [folder, locale, t.folderTitle, m.workspace.documents])

  useEffect(() => {
    if (!previewEntry) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPreviewEntry(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previewEntry])

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    setUploading(true)
    try {
      const entry = await uploadDocumentFile(org.id, siteId, folderId, file)
      entriesRemote.update((entries) => [entry, ...entries])
    } catch {
      setUploadError(t.uploadError)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDownload(entry: DocumentEntry) {
    setDownloadError(null)
    try {
      await downloadFile(entry.downloadUrl, entry.fileName)
    } catch {
      setDownloadError(t.downloadError)
    }
  }

  async function handleDelete(entry: DocumentEntry) {
    try {
      await deleteDocumentEntry(org.id, siteId, folderId, entry.id)
      entriesRemote.update((entries) => entries.filter((e) => e.id !== entry.id))
      setDeleting(null)
    } catch {
      setDeleteError(t.deleteFileError)
    }
  }

  const displayName = folder ? folderName(folder, locale) : t.folderTitle

  return (
    <div className="page">
      <BackLink to={`/documents/sites/${encodeURIComponent(siteId)}`}>{t.backToFolders}</BackLink>
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
              aria-busy={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? t.uploading : t.uploadFile}
            </button>
          </div>
        )}
      </header>

      {deleting && (
        <ConfirmDialog
          title={t.delete}
          body={t.deleteConfirm}
          confirmLabel={t.delete}
          pendingLabel={t.deleting}
          cancelLabel={t.cancel}
          error={deleteError}
          onConfirm={() => handleDelete(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}

      {uploadError && (
        <Notice tone="error">{uploadError}</Notice>
      )}
      {downloadError && (
        <Notice tone="error">{downloadError}</Notice>
      )}

      {entriesRemote.status === 'loading' && <SkeletonList />}
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
                {isImageFile(entry) && (
                  <div className="document-entry__thumb-wrap">
                    <img
                      className="document-entry__thumb"
                      src={entry.downloadUrl}
                      alt=""
                      loading="lazy"
                    />
                  </div>
                )}
                <span className="document-entry__name" title={entry.fileName}>{entry.fileName}</span>
                <span className="document-entry__meta">
                  {formatBytes(entry.fileSize)}{entry.fileSize ? ' · ' : ''}{formatDate(entry.createdAt, locale)}
                </span>
                <div className="document-entry__actions">
                  {(isImageFile(entry) || isPdfFile(entry)) && (
                    <button
                      className="button button--ghost button--sm"
                      type="button"
                      onClick={() => setPreviewEntry(entry)}
                    >
                      {t.preview}
                    </button>
                  )}
                  {isExcelFile(entry) && (
                    <button
                      className="button button--ghost button--sm"
                      type="button"
                      onClick={() => navigate('/excel')}
                    >
                      {t.openInExcel}
                    </button>
                  )}
                  <button
                    className="button button--ghost button--sm"
                    type="button"
                    onClick={() => handleDownload(entry)}
                  >
                    {t.download}
                  </button>
                  {canManage && (
                    <button
                      className="button button--ghost button--sm button--danger"
                      type="button"
                      onClick={() => {
                        setDeleteError(null)
                        setDeleting(entry)
                      }}
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

      {previewEntry && (
        <div
          className="document-preview-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={previewEntry.fileName}
          onClick={() => setPreviewEntry(null)}
        >
          <button
            className="document-preview-overlay__close button button--ghost"
            type="button"
            onClick={() => setPreviewEntry(null)}
          >
            ✕
          </button>
          {isPdfFile(previewEntry) ? (
            <iframe
              className="document-preview-overlay__pdf"
              src={previewEntry.downloadUrl}
              title={previewEntry.fileName}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              className="document-preview-overlay__img"
              src={previewEntry.downloadUrl}
              alt={previewEntry.fileName}
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}

    </div>
  )
}
