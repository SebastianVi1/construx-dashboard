import { useState } from 'react'
import { Link } from 'react-router'
import { ChevronDownIcon, SignOutIcon, UserIcon } from '../../components/icons'
import { usePopover } from '../../components/popover'
import { LocaleSwitcher, useLocale } from '../../i18n'
import { ThemeSwitcher } from '../../theme'
import { useAuth } from '../auth/auth-context'
import { Avatar } from './Avatar'
import { displayName } from './profileDisplay'
import { useMyProfile } from './useMyProfile'
import './profile.css'

/** Who is signed in, at the end of the workspace header: profile, language and sign out. */
export function AccountMenu() {
  const { messages: m } = useLocale()
  const { user, signOut } = useAuth()
  const profile = useMyProfile()
  const { open, triggerRef, panelRef, panelId, toggle, close } = usePopover()
  const [signingOut, setSigningOut] = useState(false)

  if (!user) return null

  const fullName = profile.data?.fullName ?? null
  const name = displayName(fullName, user.email)

  const leave = async () => {
    setSigningOut(true)
    try {
      await signOut()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="account-menu">
      <button
        ref={triggerRef}
        type="button"
        className="account-menu__trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        aria-label={`${m.workspace.accountMenu}: ${name}`}
      >
        <Avatar fullName={fullName} email={user.email} decorative />
        <span className="account-menu__name">{name}</span>
        <ChevronDownIcon className="account-menu__chevron" width="16" height="16" />
      </button>

      <div ref={panelRef} id={panelId} className="popover account-menu__panel" hidden={!open}>
        <div className="account-menu__who">
          <Avatar fullName={fullName} email={user.email} decorative />
          <span className="account-menu__who-text">
            <span className="popover__item-title">{name}</span>
            {fullName?.trim() ? <span className="popover__item-meta">{user.email}</span> : null}
          </span>
        </div>
        <Link className="popover__item" to="/account" onClick={() => close(false)}>
          <UserIcon width="18" height="18" />
          <span>{m.profile.title}</span>
        </Link>
        <div className="popover__row">
          <span>{m.common.language}</span>
          <LocaleSwitcher />
        </div>
        <div className="popover__row">
          <span>{m.common.theme}</span>
          <ThemeSwitcher />
        </div>
        <div className="popover__footer">
          <button
            type="button"
            className="popover__item popover__item--danger"
            disabled={signingOut}
            onClick={() => void leave()}
          >
            <SignOutIcon width="18" height="18" />
            <span>{signingOut ? m.auth.account.signingOut : m.auth.account.signOut}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
