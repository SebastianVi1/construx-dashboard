import { useEffect } from 'react'
import { Link } from 'react-router'
import { useRemoteData } from '../../components/data/useRemoteData'
import { LoadingState, Notice } from '../../components/page'
import { formatMessage, useLocale } from '../../i18n'
import { useAuth } from '../auth/auth-context'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { roleLabel, usePermissions } from '../permissions'
import { SiteStatusBadge } from '../sites/SiteBits'
import { listSites } from '../sites/sitesApi'
import { Avatar } from './Avatar'
import { displayName } from './profileDisplay'
import { useMyProfile } from './useMyProfile'
import './profile.css'

/** The signed-in person: identity, role in the selected company, their sites, and sign-out. */
export function ProfilePage() {
  const { messages: m } = useLocale()
  const t = m.profile
  const { user, signOut } = useAuth()
  const organization = useCurrentOrganization()
  const { access } = usePermissions()
  const profile = useMyProfile()
  const orgId = organization.id
  const sites = useRemoteData(`${orgId}:sites`, () => listSites(orgId))

  useEffect(() => {
    document.title = `${t.title} | Construx`
  }, [t.title])

  // RequireAuth guards the route; this only narrows the type.
  if (!user) return null

  const fullName = profile.data?.fullName ?? null
  const role = access ? roleLabel(access.role, m.roles) : null

  return (
    <div className="page">
      <header className="profile-hero">
        <Avatar fullName={fullName} email={user.email} size="large" />
        <div className="profile-hero__text">
          <h1>{displayName(fullName, user.email)}</h1>
          <p>{user.email}</p>
          <div className="profile-hero__meta">
            {role ? (
              <span className="badge" data-tone="accent">
                {role}
              </span>
            ) : null}
            <span>{organization.name}</span>
          </div>
        </div>
        <button type="button" className="button" onClick={() => void signOut()}>
          {m.auth.account.signOut}
        </button>
      </header>

      <section className="page-section" aria-labelledby="profile-details">
        <div className="page-section__header">
          <h2 id="profile-details">{t.detailsTitle}</h2>
        </div>
        {profile.status === 'error' ? (
          <Notice tone="error" action={{ label: m.workspace.retry, onClick: profile.reload }}>
            {t.profileError}
          </Notice>
        ) : profile.data ? (
          <dl className="profile-details">
            <ProfileField label={t.fullName} value={profile.data.fullName} empty={t.notSet} />
            <ProfileField label={t.email} value={user.email} empty={t.notSet} />
            <ProfileField label={t.phone} value={profile.data.phoneNumber} empty={t.notSet} />
            <ProfileField label={t.trade} value={profile.data.trade} empty={t.notSet} />
            <ProfileField label={t.company} value={organization.name} empty={t.notSet} />
            <ProfileField label={t.role} value={role} empty={t.notSet} />
          </dl>
        ) : (
          <LoadingState label={m.workspace.loading} />
        )}
      </section>

      <section className="page-section" aria-labelledby="profile-sites">
        <div className="page-section__header">
          <div>
            <h2 id="profile-sites">{t.sitesTitle}</h2>
            <p>{formatMessage(t.sitesDescription, { company: organization.name })}</p>
          </div>
        </div>
        {sites.status === 'error' ? (
          <Notice tone="error" action={{ label: m.workspace.retry, onClick: sites.reload }}>
            {t.sitesError}
          </Notice>
        ) : sites.data ? (
          sites.data.length > 0 ? (
            <ul className="profile-sites">
              {sites.data.map((site) => (
                <li key={site.id}>
                  <Link className="profile-sites__link" to={`/sites/${encodeURIComponent(site.id)}`}>
                    <span className="profile-sites__name">{site.name}</span>
                    {site.address ? <span className="profile-sites__address">{site.address}</span> : null}
                  </Link>
                  <SiteStatusBadge status={site.status} labels={m.sites.status} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">
              <p>{t.sitesEmpty}</p>
            </div>
          )
        ) : (
          <LoadingState label={m.workspace.loading} />
        )}
      </section>
    </div>
  )
}

function ProfileField({ label, value, empty }: { label: string; value: string | null; empty: string }) {
  const text = value?.trim()
  return (
    <div className="profile-details__row">
      <dt>{label}</dt>
      <dd data-empty={text ? undefined : true}>{text || empty}</dd>
    </div>
  )
}
