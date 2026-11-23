import { useEffect } from 'react'
import { useParams } from 'react-router'
import { useRemoteData } from '../../components/data/useRemoteData'
import { BackLink, Notice, SkeletonList } from '../../components/page'
import { useLocale, type Locale, type Messages } from '../../i18n'
import { ApiError } from '../../lib/http'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { roleLabel } from '../permissions'
import { PeopleTabs } from './PeopleTabs'
import { RoleBadges } from './RoleBits'
import { PermissionsTab } from './PermissionsTab'
import { getRole, type RoleDetail } from './rolesApi'
import { invitationCountLabel, memberCountLabel } from './roleView'
import './roles.css'

/** People › Roles & permissions › one role (roles contract §8.3): header and its Permissions. */
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
        <RoleContent
          role={role.data}
          onSaved={(saved) => role.update(() => saved)}
          onReload={role.reload}
          m={m}
          locale={locale}
        />
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

type RoleContentProps = {
  role: RoleDetail
  onSaved: (role: RoleDetail) => void
  onReload: () => void
  m: Messages
  locale: Locale
}

function RoleContent({ role, onSaved, onReload, m, locale }: RoleContentProps) {
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

      <PermissionsTab role={role} onSaved={onSaved} onReload={onReload} />
    </>
  )
}
