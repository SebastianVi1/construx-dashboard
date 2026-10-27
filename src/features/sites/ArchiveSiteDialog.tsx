import { useState } from 'react'
import { Modal } from '../../components/modal'
import { useLocale } from '../../i18n'
import { siteErrorKind, updateSite, type Site, type SiteErrorKind } from './sitesApi'

type ArchiveSiteDialogProps = {
  organizationId: string
  site: Site
  onArchived: (site: Site) => void
  onClose: () => void
}

/** Confirm, then archive with `PATCH { status: 'ARCHIVED' }` (there is no delete). */
export function ArchiveSiteDialog({ organizationId, site, onArchived, onClose }: ArchiveSiteDialogProps) {
  const { messages: m } = useLocale()
  const t = m.sites
  const [busy, setBusy] = useState(false)
  const [errorKind, setErrorKind] = useState<SiteErrorKind | null>(null)

  async function archive() {
    if (busy) return
    setBusy(true)
    setErrorKind(null)
    try {
      onArchived(await updateSite(organizationId, site.id, { status: 'ARCHIVED' }))
    } catch (error) {
      setErrorKind(siteErrorKind(error))
      setBusy(false)
    }
  }

  return (
    <Modal title={t.detail.archiveTitle} description={t.detail.archiveBody} onClose={onClose}>
      {errorKind ? (
        <p className="form-error" role="alert">
          {t.error[errorKind]}
        </p>
      ) : null}
      <div className="button-row button-row--end modal-actions">
        <button type="button" className="button" onClick={onClose} disabled={busy}>
          {t.detail.cancel}
        </button>
        <button type="button" className="button button--danger" onClick={() => void archive()} disabled={busy}>
          {busy ? t.detail.archiving : t.detail.archiveConfirm}
        </button>
      </div>
    </Modal>
  )
}
