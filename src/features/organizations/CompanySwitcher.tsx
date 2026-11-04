import { useState } from 'react'
import { Link } from 'react-router'
import { CheckIcon, ChevronDownIcon, DotsVerticalIcon, PlusIcon, TrashIcon } from '../../components/icons'
import { usePopover } from '../../components/popover'
import { formatMessage, useLocale } from '../../i18n'
import { roleLabel } from '../permissions/roles'
import { useOrganizations } from './organizations-context'
import { deleteOrganization, type Organization } from './organizationsApi'

/**
 * The selected company in the header (design.md "signature"): opens a list of
 * the user's companies with their role, plus a way to found a new one.
 */
export function CompanySwitcher() {
  const { organizations, current, select, remove } = useOrganizations()
  const { messages: m } = useLocale()
  const t = m.workspace
  const ctx = m.organizations.context
  const { open, triggerRef, panelRef, panelId, toggle, close } = usePopover()
  const [announcement, setAnnouncement] = useState('')
  const [menuOrgId, setMenuOrgId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  if (!current) return null

  const choose = (organization: Organization) => {
    close()
    setMenuOrgId(null)
    if (organization.id === current.id) return
    select(organization.id)
    setAnnouncement(formatMessage(t.companySwitched, { name: organization.name }))
  }

  const toggleMenu = (orgId: string) => {
    setDeleteError(null)
    setMenuOrgId((prev) => (prev === orgId ? null : orgId))
  }

  const handleDelete = async (organization: Organization) => {
    const confirmed = window.confirm(
      formatMessage(ctx.deleteConfirm, { name: organization.name }),
    )
    if (!confirmed) return
    setDeleteError(null)
    setDeletingId(organization.id)
    try {
      await deleteOrganization(organization.id)
      remove(organization.id)
      setMenuOrgId(null)
      if (organizations.length <= 1) close()
    } catch {
      setDeleteError(ctx.deleteError)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="company-switcher">
      <button
        ref={triggerRef}
        type="button"
        className="company-switcher__trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        aria-label={`${ctx.switch}: ${current.name}`}
      >
        <span className="company-switcher__tile" aria-hidden="true">
          {current.name.trim().charAt(0).toUpperCase()}
        </span>
        <span className="company-switcher__text">
          <span className="company-switcher__name">{current.name}</span>
          {current.myRole ? (
            <span className="company-switcher__role">{roleLabel(current.myRole, m.roles)}</span>
          ) : null}
        </span>
        <ChevronDownIcon className="company-switcher__chevron" width="16" height="16" />
      </button>

      <div
        ref={panelRef}
        id={panelId}
        className="popover company-switcher__panel"
        hidden={!open}
      >
        <p className="popover__label">{t.companies}</p>
        <ul className="popover__list" aria-label={t.companies}>
          {organizations.map((organization) => {
            const selected = organization.id === current.id
            const menuOpen = menuOrgId === organization.id
            const isDeleting = deletingId === organization.id
            return (
              <li key={organization.id}>
                <div className="popover__org-row">
                  <button
                    type="button"
                    className="popover__item popover__org-select"
                    aria-current={selected ? 'true' : undefined}
                    onClick={() => choose(organization)}
                  >
                    <span className="popover__item-text">
                      <span className="popover__item-title">{organization.name}</span>
                      {organization.myRole ? (
                        <span className="popover__item-meta">{roleLabel(organization.myRole, m.roles)}</span>
                      ) : null}
                    </span>
                    {selected ? <CheckIcon className="popover__check" width="18" height="18" /> : null}
                  </button>
                  <button
                    type="button"
                    className="popover__org-menu"
                    aria-label={`${ctx.moreOptions}: ${organization.name}`}
                    aria-expanded={menuOpen}
                    disabled={isDeleting}
                    onClick={() => toggleMenu(organization.id)}
                  >
                    <DotsVerticalIcon width="16" height="16" />
                  </button>
                </div>
                {menuOpen && (
                  <div className="popover__org-actions">
                    <button
                      type="button"
                      className="popover__item popover__item--danger"
                      disabled={isDeleting}
                      onClick={() => void handleDelete(organization)}
                    >
                      <TrashIcon width="16" height="16" />
                      <span>{isDeleting ? ctx.deleting : ctx.deleteCompany}</span>
                    </button>
                    {deleteError ? (
                      <p className="popover__org-error">{deleteError}</p>
                    ) : null}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        <div className="popover__footer">
          <Link className="popover__item" to="/organizations/new" onClick={() => close(false)}>
            <PlusIcon width="18" height="18" />
            <span>{ctx.newCompany}</span>
          </Link>
        </div>
      </div>

      <span className="visually-hidden" role="status">
        {announcement}
      </span>
    </div>
  )
}
