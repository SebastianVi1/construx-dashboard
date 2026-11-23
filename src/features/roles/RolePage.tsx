import { useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { useRemoteData } from '../../components/data/useRemoteData'
import { BackLink, Notice, SkeletonList } from '../../components/page'
import { useLocale, type Locale, type Messages } from '../../i18n'
import { ApiError } from '../../lib/http'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { roleLabel, usePermissions } from '../permissions'
import { PeopleTab } from './PeopleTab'
import { PeopleTabs } from './PeopleTabs'
import { RoleBadges } from './RoleBits'
import { getCatalog, getRole, type RoleDetail } from './rolesApi'
import { invitationCountLabel, memberCountLabel, permissionGroups, readOnlyReason } from './roleView'
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
  const role = useRemoteData(`${orgId}:role:${code}`, () => getRole(orgId, code))
  const title = role.data ? roleLabel(role.data, locale) : t.list.title

  useEffect(() => {
    document.title = `${title} | Construx`
  }, [title])

  return (
    <div className="page">
      <PeopleTabs />
      <BackLink to="/members/roles">{t.role.back}</BackLink>
      {role.data ? (
        <RoleContent role={role.data} m={m} locale={locale} onPeopleChanged={role.reload} />
      ) : role.status === 'error' ? (
        role.error instanceof ApiError && role.error.status === 404 ? (
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

type RoleContentProps = { role: RoleDetail; m: Messages; locale: Locale; onPeopleChanged: () => void }

function RoleContent({ role, m, locale, onPeopleChanged }: RoleContentProps) {
  const t = m.roles
  const { access, can } = usePermissions()
  const organization = useCurrentOrganization()
  const canSeePeople = can('MANAGE_MEMBERS')
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = roleTab(searchParams, canSeePeople)
  const catalog = useRemoteData('permissions:catalog', getCatalog)
  const reason = readOnlyReason(role, access?.role.code ?? null)
  const description = role.description?.[locale] ?? null
  const invitations = invitationCountLabel(role.pendingInvitationCount, m)

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
      </header>

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

      {tab === 'permissions' && reason ? <Notice>{t.readOnly[reason]}</Notice> : null}
      {tab === 'permissions' && role.permissions.length === 0 ? <Notice>{t.role.empty}</Notice> : null}

      <section className="page-section" aria-labelledby="role-permissions-heading" hidden={tab !== 'permissions'}>
        <div className="page-section__header">
          <h2 id="role-permissions-heading">{t.role.permissions}</h2>
        </div>
        {catalog.data ? (
          <div className="permission-groups">
            {permissionGroups(catalog.data, role.permissions).map((group) => (
              <section key={group.key} className="permission-group" aria-labelledby={`permission-group-${group.key}`}>
                <h3 id={`permission-group-${group.key}`}>{group.names[locale]}</h3>
                <ul className="permission-rows">
                  {group.rows.map(({ action, scope }) => (
                    <li key={action.action} className="permission-row">
                      <span className="permission-row__text">
                        <span className="permission-row__name">{action.names[locale]}</span>
                        <span className="permission-row__description">{action.descriptions[locale]}</span>
                      </span>
                      <span className="permission-scope" data-scope={scope ?? 'NONE'}>
                        {scope ? t.scope[scope] : t.scope.none}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : catalog.status === 'error' ? (
          <Notice tone="error" action={{ label: t.retry, onClick: catalog.reload }}>
            {t.role.catalogError}
          </Notice>
        ) : (
          <SkeletonList rows={8} />
        )}
      </section>
    </>
  )
}
