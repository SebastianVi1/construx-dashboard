import { useId } from 'react'
import { formatMessage, useLocale } from '../../i18n'
import { roleLabel } from '../permissions'
import type { RoleRef } from '../permissions/can'
import { roleChoice } from './roleAssignment'
import type { RoleSummary } from './rolesApi'
import './people.css'

type RoleSelectProps = {
  member: { membershipId: string; role: RoleRef }
  /** `GET /roles` for the caller; undefined while loading. */
  roles: RoleSummary[] | undefined
  myMembershipId: string | null
  /** The member's display name, for the accessible label. */
  name: string
  /** The role a change in flight for this member moves them to; shown until the server answers. */
  pendingCode: string | null
  /** Another change is in flight: hold this one. */
  disabled: boolean
  onChange: (roleCode: string) => void
}

/**
 * A member's role as a dropdown of the roles the caller may assign (roles
 * contract §8.4). Locked, with the reason, for the Owner, the caller and a
 * member whose current role is above the caller.
 */
export function RoleSelect({ member, roles, myMembershipId, name, pendingCode, disabled, onChange }: RoleSelectProps) {
  const { messages: m, locale } = useLocale()
  const t = m.roles.roleSelect
  const reasonId = useId()
  const { options, lock } = roleChoice(member, roles, myMembershipId)
  const reason = lock ? t.lock[lock] : null

  return (
    <span className="role-select">
      <select
        value={pendingCode ?? member.role.code}
        aria-label={formatMessage(t.label, { name })}
        aria-describedby={reason ? reasonId : undefined}
        aria-busy={pendingCode !== null}
        title={reason ?? undefined}
        disabled={lock !== null || disabled || pendingCode !== null}
        onChange={(event) => {
          if (event.target.value !== member.role.code) onChange(event.target.value)
        }}
      >
        {options.map((role) => (
          <option key={role.code} value={role.code}>
            {roleLabel(role, locale)}
          </option>
        ))}
      </select>
      {reason ? (
        <span id={reasonId} className="visually-hidden">
          {reason}
        </span>
      ) : null}
    </span>
  )
}
