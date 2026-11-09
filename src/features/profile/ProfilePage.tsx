import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useRemoteData } from '../../components/data/useRemoteData'
import { SkeletonList, Notice } from '../../components/page'
import { formatMessage, useLocale } from '../../i18n'
import { forgotPassword } from '../auth/authApi'
import { useAuth } from '../auth/auth-context'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { roleLabel, usePermissions } from '../permissions'
import { SiteStatusBadge } from '../sites/SiteBits'
import { listSites } from '../sites/sitesApi'
import { Avatar } from './Avatar'
import { AvatarPicker } from './AvatarPicker'
import { EditProfileDialog } from './EditProfileDialog'
import { formatPhone } from './phone'
import type { AvatarErrorKind } from './profileApi'
import { displayName } from './profileDisplay'
import { publishProfile, useMyProfile } from './useMyProfile'
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
  const [editing, setEditing] = useState(false)
  const [photoError, setPhotoError] = useState<AvatarErrorKind | null>(null)
  const [resetState, setResetState] = useState<'idle' | 'pending' | 'sent' | 'error'>('idle')

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
        <div className="profile-hero__identity">
          {profile.data ? (
            <AvatarPicker profile={profile.data} email={user.email} onError={setPhotoError} />
          ) : (
            <Avatar fullName={fullName} email={user.email} size="large" />
          )}
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
        </div>
        <button type="button" className="button" onClick={() => void signOut()}>
          {m.auth.account.signOut}
        </button>
      </header>

      {photoError ? (
        <p role="alert" className="form-error profile-photo-error">
          {t.photo.errors[photoError]}
        </p>
      ) : null}

      <section className="page-section" aria-labelledby="profile-details">
        <div className="page-section__header">
          <h2 id="profile-details">{t.detailsTitle}</h2>
          {profile.data ? (
            <button type="button" className="button" onClick={() => setEditing(true)}>
              {t.edit.open}
            </button>
          ) : null}
        </div>
        {profile.status === 'error' ? (
          <Notice tone="error" action={{ label: m.workspace.retry, onClick: profile.reload }}>
            {t.profileError}
          </Notice>
        ) : profile.data ? (
          <dl className="profile-details">
            <ProfileField label={t.fullName} value={profile.data.fullName} empty={t.notSet} />
            <ProfileField label={t.email} value={user.email} empty={t.notSet} />
            <ProfileField label={t.phone} value={formatPhone(profile.data.phoneNumber)} empty={t.notSet} />
            <ProfileField label={t.trade} value={profile.data.trade} empty={t.notSet} />
            <ProfileField label={t.company} value={organization.name} empty={t.notSet} />
            <ProfileField label={t.role} value={role} empty={t.notSet} />
          </dl>
        ) : (
          <SkeletonList />
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
          <SkeletonList />
        )}
      </section>

      <section className="page-section" aria-labelledby="profile-security">
        <div className="page-section__header">
          <h2 id="profile-security">{t.security.title}</h2>
        </div>
        <div className="security-card">
          <div className="security-card__icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="9" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M7 9V6a3 3 0 0 1 6 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="10" cy="14" r="1.25" fill="currentColor" />
            </svg>
          </div>
          <div className="security-card__body">
            <h3 className="security-card__title">{t.security.passwordTitle}</h3>
            <p className="security-card__description">
              {t.security.passwordDescription}
            </p>
            {resetState === 'sent' ? (
              <p role="status" className="security-card__sent">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {formatMessage(t.security.linkSent, { email: user.email })}
              </p>
            ) : (
              <button
                type="button"
                className="button security-card__action"
                disabled={resetState === 'pending'}
                onClick={() => {
                  setResetState('pending')
                  forgotPassword(user.email)
                    .then(() => setResetState('sent'))
                    .catch(() => setResetState('error'))
                }}
              >
                {resetState === 'pending' ? t.security.sendLinkPending : t.security.sendLink}
              </button>
            )}
            {resetState === 'error' ? (
              <p role="alert" className="form-error security-card__error">{t.security.linkError}</p>
            ) : null}
          </div>
        </div>
      </section>

      {editing && profile.data ? (
        <EditProfileDialog
          profile={profile.data}
          onSaved={(saved) => {
            publishProfile(saved)
            setEditing(false)
          }}
          onClose={() => setEditing(false)}
        />
      ) : null}
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
