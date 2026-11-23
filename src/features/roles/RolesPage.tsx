import { useEffect } from 'react'
import { Link } from 'react-router'
import { useRemoteData } from '../../components/data/useRemoteData'
import { Notice, SkeletonList } from '../../components/page'
import { useLocale } from '../../i18n'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { roleLabel } from '../permissions'
import { PeopleTabs } from './PeopleTabs'
import { RoleBadges } from './RoleBits'
import { memberCountLabel } from './roleView'
import { listRoles } from './rolesApi'
import './roles.css'

/** People › Roles & permissions (roles contract §8.2): every role of the company, read-only for now. */
export function RolesPage() {
  const { messages: m, locale } = useLocale()
  const t = m.roles
  const organization = useCurrentOrganization()
  const orgId = organization.id
  const roles = useRemoteData(`${orgId}:roles`, () => listRoles(orgId))

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
      </header>

      {roles.data ? (
        <ul className="role-list" aria-label={t.list.label}>
          {roles.data.map((role) => {
            const description = role.description?.[locale] ?? null
            return (
              <li key={role.id}>
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
    </div>
  )
}
