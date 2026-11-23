import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useRemoteData } from '../../components/data/useRemoteData'
import { Notice, SkeletonList } from '../../components/page'
import { formatMessage, useLocale } from '../../i18n'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { roleLabel, usePermissions } from '../permissions'
import { PeopleTabs } from './PeopleTabs'
import { canCreateRole, canDuplicate } from './customRoles'
import { RoleBadges } from './RoleBits'
import { RoleFormDialog } from './RoleFormDialog'
import { memberCountLabel } from './roleView'
import { listRoles, type RoleSummary } from './rolesApi'
import './roles.css'

/**
 * People › Roles & permissions (roles contract §8.2): every role of the company.
 * With MANAGE_ROLES, "New role" (below the 30 Custom role limit) and "Duplicate"
 * on each role whose permissions fit within the caller.
 */
export function RolesPage() {
  const { messages: m, locale } = useLocale()
  const t = m.roles
  const organization = useCurrentOrganization()
  const orgId = organization.id
  const roles = useRemoteData(`${orgId}:roles`, () => listRoles(orgId))
  const { access, can } = usePermissions()
  const manageRoles = can('MANAGE_ROLES')
  const myRoleCode = access?.role.code ?? null
  // `null` = closed, `'new'` = blank role, a role = duplicate it.
  const [creating, setCreating] = useState<RoleSummary | 'new' | null>(null)
  const location = useLocation()
  const navigate = useNavigate()
  // Read once, then dropped from history so a reload or a return does not announce it again.
  const [deletedRole] = useState(() => deletedRoleName(location.state))
  const createAllowed = roles.data ? canCreateRole(roles.data, manageRoles) : false
  const atLimit = manageRoles && roles.data !== undefined && !createAllowed

  useEffect(() => {
    if (deletedRoleName(location.state)) navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, navigate])

  useEffect(() => {
    document.title = `${t.list.title} | Construx`
  }, [t.list.title])

  return (
    <div className="page">
      <PeopleTabs />
      <header className="page-header">
        <div className="page-header__text">
          <h1>{t.list.title}</h1>
          <p>{t.list.description}</p>
        </div>
        {createAllowed ? (
          <button type="button" className="button button--primary" onClick={() => setCreating('new')}>
            {t.create.button}
          </button>
        ) : null}
      </header>

      {deletedRole ? <Notice tone="success">{formatMessage(t.remove.done, { role: deletedRole })}</Notice> : null}
      {atLimit ? <Notice>{t.create.limit}</Notice> : null}

      {roles.data ? (
        <ul className="role-list" aria-label={t.list.label}>
          {roles.data.map((role) => {
            const description = role.description?.[locale] ?? null
            const duplicable = createAllowed && canDuplicate(role, myRoleCode)
            return (
              <li key={role.id} className="role-list__item">
                <Link className="role-list__row" to={`/members/roles/${encodeURIComponent(role.code)}`}>
                  <span className="role-list__main">
                    <span className="role-list__title">
                      <span className="role-list__name">{roleLabel(role, locale)}</span>
                      <RoleBadges role={role} m={m} />
                    </span>
                    {description ? <span className="role-list__description">{description}</span> : null}
                  </span>
                  <span className="role-list__end">
                    <span className="role-list__count">{memberCountLabel(role.memberCount, m)}</span>
                    {role.editable ? null : <span className="role-list__view-only">{t.viewOnly}</span>}
                  </span>
                </Link>
                {duplicable ? (
                  <button
                    type="button"
                    className="button button--small role-list__duplicate"
                    aria-label={formatMessage(t.duplicate.label, { role: roleLabel(role, locale) })}
                    onClick={() => setCreating(role)}
                  >
                    {t.duplicate.button}
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : roles.status === 'error' ? (
        <Notice tone="error" action={{ label: t.retry, onClick: roles.reload }}>
          {t.list.loadError}
        </Notice>
      ) : (
        <SkeletonList rows={6} />
      )}

      {creating ? (
        <RoleFormDialog organizationId={orgId} source={creating === 'new' ? undefined : creating} onClose={() => setCreating(null)} />
      ) : null}
    </div>
  )
}

/** The name the role page passed along after deleting a role, if any. */
function deletedRoleName(state: unknown): string | null {
  if (typeof state !== 'object' || state === null || !('deletedRole' in state)) return null
  return typeof state.deletedRole === 'string' ? state.deletedRole : null
}
