import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { useRemoteData } from '../../components/data/useRemoteData'
import { BackLink, Notice, SkeletonList } from '../../components/page'
import { useLocale, type Locale, type Messages } from '../../i18n'
import { ApiError } from '../../lib/http'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { roleLabel, usePermissions } from '../permissions'
import { DeleteRoleDialog } from './DeleteRoleDialog'
import { PeopleTab } from './PeopleTab'
import { PeopleTabs } from './PeopleTabs'
import { PermissionsTab } from './PermissionsTab'
import { RoleBadges } from './RoleBits'
import { canDeleteRole } from './customRoles'
import { getRole, type RoleDetail } from './rolesApi'
import { roleDeleted, roleKey } from './rolesCache'
import { invitationCountLabel, memberCountLabel } from './roleView'
import { roleTab, roleTabSearch } from './roleAssignment'
import '../../components/filter/filter-tabs.css'
import './roles.css'

/** People › Roles & permissions › one role (roles contract §8.3): its Permissions and, with MANAGE_MEMBERS, its People. */
export function RolePage() {
  const { messages: m, locale } = useLocale()
  const t = m.roles
  const { code = '' } = useParams()
  const organization = useCurrentOrganization()
  const orgId = organization.id
  // A 404 is final: a role deleted here or by someone else never shows again from the remembered copy.
  const role = useRemoteData(roleKey(orgId, code), () => getRole(orgId, code), { gone: isNotFound })
  const navigate = useNavigate()
  const title = role.data ? roleLabel(role.data, locale) : t.list.title

  useEffect(() => {
    document.title = `${title} | Construx`
  }, [title])

  return (
    <div className="page">
      <PeopleTabs />
      <BackLink to="/members/roles">{t.role.back}</BackLink>
      {role.data ? (
        <RoleContent
          role={role.data}
          m={m}
          locale={locale}
          onSaved={(saved) => role.update(() => saved)}
          onReload={role.reload}
          onPeopleChanged={role.reload}
          onDeleted={() => {
            // The list shows without the deleted role straight away; the refetch brings the moved counts.
            roleDeleted(orgId, code)
            navigate('/members/roles', { state: { deletedRole: title } })
          }}
        />
      ) : role.status === 'error' ? (
        isNotFound(role.error) ? (
          <Notice>{t.role.notFound}</Notice>
        ) : (
          <Notice tone="error" action={{ label: t.retry, onClick: role.reload }}>
            {t.role.loadError}
          </Notice>
        )
      ) : (
        <SkeletonList rows={6} />
      )}
    </div>
  )
}

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404
}

type RoleContentProps = {
  role: RoleDetail
  m: Messages
  locale: Locale
  /** A save or restore answered with the role's new state. */
  onSaved: (role: RoleDetail) => void
  /** Someone else saved the role first: load it again. */
  onReload: () => void
  onPeopleChanged: () => void
  /** The role was deleted: leave its page. */
  onDeleted: () => void
}

function RoleContent({ role, m, locale, onSaved, onReload, onPeopleChanged, onDeleted }: RoleContentProps) {
  const t = m.roles
  const { access, can } = usePermissions()
  const organization = useCurrentOrganization()
  const canSeePeople = can('MANAGE_MEMBERS')
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = roleTab(searchParams, canSeePeople)
  const description = role.description?.[locale] ?? null
  const invitations = invitationCountLabel(role.pendingInvitationCount, m)
  const [deleting, setDeleting] = useState(false)
  const canDelete = canDeleteRole(role, canSeePeople)

  return (
    <>
      <header className="page-header role-header">
        <div className="page-header__text">
          <div className="role-header__title">
            <h1>{roleLabel(role, locale)}</h1>
            <RoleBadges role={role} m={m} />
          </div>
          {description ? <p>{description}</p> : null}
          <p className="role-header__meta">
            {memberCountLabel(role.memberCount, m)}
            {invitations ? ` · ${invitations}` : null}
          </p>
        </div>
        {canDelete ? (
          <button type="button" className="button button--danger" onClick={() => setDeleting(true)}>
            {t.remove.button}
          </button>
        ) : null}
      </header>

      {deleting ? (
        <DeleteRoleDialog organizationId={organization.id} role={role} onDeleted={onDeleted} onClose={() => setDeleting(false)} />
      ) : null}

      {canSeePeople ? (
        <nav className="filter-tabs" aria-label={t.tabs.label}>
          {(['permissions', 'people'] as const).map((key) => (
            <button
              key={key}
              type="button"
              className="filter-tabs__tab"
              aria-pressed={tab === key}
              onClick={() => setSearchParams(roleTabSearch(searchParams, key), { replace: true })}
            >
              {t.tabs[key]}
            </button>
          ))}
        </nav>
      ) : null}

      {tab === 'people' ? (
        <PeopleTab
          organizationId={organization.id}
          role={role}
          myMembershipId={access?.membershipId ?? null}
          onChanged={onPeopleChanged}
        />
      ) : null}

      {/* Kept mounted while People is open, so unsaved permission edits survive a tab switch. */}
      <PermissionsTab role={role} onSaved={onSaved} onReload={onReload} hidden={tab !== 'permissions'} />
    </>
  )
}
