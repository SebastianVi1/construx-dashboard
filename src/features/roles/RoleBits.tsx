import type { Messages } from '../../i18n'
import type { RoleSummary } from './rolesApi'

/** Kind badge plus "Customized" for a Built-in role the company changed. */
export function RoleBadges({ role, m }: { role: RoleSummary; m: Messages }) {
  const t = m.roles
  return (
    <span className="role-badges">
      <span className="badge" data-tone={role.kind === 'CUSTOM' ? 'accent' : role.kind === 'OWNER' ? undefined : 'muted'}>
        {t.kind[role.kind]}
      </span>
      {role.customized ? (
        <span className="badge" data-tone="warning">
          {t.customized}
        </span>
      ) : null}
    </span>
  )
}
