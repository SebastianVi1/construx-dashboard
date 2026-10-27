import { NavLink } from 'react-router'
import { useLocale } from '../../i18n'
import { useAuth } from '../auth/auth-context'
import { Avatar } from './Avatar'
import { displayName } from './profileDisplay'
import { useMyProfile } from './useMyProfile'
import './profile.css'

/** Who is signed in, at the foot of the workspace navigation; opens the profile. */
export function AccountNavLink() {
  const { messages: m } = useLocale()
  const { user } = useAuth()
  const profile = useMyProfile()
  if (!user) return null

  const fullName = profile.data?.fullName ?? null
  const name = displayName(fullName, user.email)

  return (
    <NavLink className="account-link" to="/account" aria-label={`${m.profile.openProfile}: ${name}`}>
      <Avatar fullName={fullName} email={user.email} decorative />
      <span className="account-link__text">
        <span className="account-link__name">{name}</span>
        {fullName?.trim() ? <span className="account-link__email">{user.email}</span> : null}
      </span>
    </NavLink>
  )
}
