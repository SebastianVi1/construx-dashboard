import { useEffect, useState } from 'react'
import { useRemoteData, type RemoteData } from '../../components/data/useRemoteData'
import { LoadingState, Notice } from '../../components/page'
import { formatMessage, intlLocales, useLocale, type Locale, type Messages } from '../../i18n'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { roleLabel, usePermissions } from '../permissions'
import { listSites, type Site } from '../sites/sitesApi'
import { InviteForm } from './InviteForm'
import {
  createInvitation,
  inviteErrorKind,
  listInvitations,
  listMembers,
  listRoles,
  revokeErrorKind,
  revokeInvitation,
  type Invitation,
  type Member,
} from './membersApi'
import './members.css'

/** Team page for MANAGE_MEMBERS holders: invite, manage pending invitations, see members. */
export function MembersPage() {
  const { messages: m } = useLocale()
  const { can } = usePermissions()

  useEffect(() => {
    document.title = `${m.members.title} | Construx`
  }, [m.members.title])

  if (!can('MANAGE_MEMBERS')) {
    return (
      <div className="page">
        <Notice>{m.workspace.forbidden}</Notice>
      </div>
    )
  }
  return <MembersContent />
}

function MembersContent() {
  const { messages: m, locale } = useLocale()
  const t = m.members
  const organization = useCurrentOrganization()
  const { can } = usePermissions()
  const orgId = organization.id
  const canInviteToSite = can('MANAGE_PROJECT')

  // Independent lists load in parallel.
  const roles = useRemoteData(`${orgId}:roles`, () => listRoles(orgId))
  const invitations = useRemoteData(`${orgId}:invitations`, () => listInvitations(orgId))
  const members = useRemoteData(`${orgId}:members`, () => listMembers(orgId))
  const sites = useRemoteData(canInviteToSite ? `${orgId}:sites` : null, () => listSites(orgId))

  const [formVersion, setFormVersion] = useState(0)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  /** A new invitation replaces any pending one for the same address. */
  function upsert(invitation: Invitation) {
    invitations.update((list) => [
      invitation,
      ...list.filter((item) => item.id !== invitation.id && item.email.toLowerCase() !== invitation.email.toLowerCase()),
    ])
  }

  async function resend(invitation: Invitation) {
    setBusyId(invitation.id)
    setFeedback(null)
    try {
      const fresh = await createInvitation(orgId, {
        email: invitation.email,
        roleCode: invitation.role.code,
        projectId: invitation.projectId ?? '',
      })
      upsert(fresh)
      setFeedback({ tone: 'success', text: formatMessage(t.pending.resent, { email: fresh.email }) })
    } catch (error) {
      setFeedback({ tone: 'error', text: t.error[inviteErrorKind(error)] })
    } finally {
      setBusyId(null)
    }
  }

  async function revoke(invitation: Invitation) {
    setBusyId(invitation.id)
    setFeedback(null)
    try {
      await revokeInvitation(orgId, invitation.id)
      invitations.update((list) => list.filter((item) => item.id !== invitation.id))
      setFeedback({ tone: 'success', text: formatMessage(t.pending.revoked, { email: invitation.email }) })
    } catch (error) {
      setFeedback({ tone: 'error', text: t.revokeError[revokeErrorKind(error)] })
    } finally {
      setBusyId(null)
    }
  }

  // Without the site list the invite still works, just without a site field. Wait
  // for it to settle so the form does not remount under the user's typing.
  const siteOptions = canInviteToSite ? (sites.data ?? null) : null
  const sitesSettled = !canInviteToSite || sites.data !== undefined || sites.status === 'error'

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__text">
          <h1>{t.title}</h1>
          <p>{t.description}</p>
        </div>
      </header>

      <div className="members-columns">
        <section className="page-section members-invite" aria-labelledby="invite-heading">
          <div className="page-section__header">
            <div>
              <h2 id="invite-heading">{t.invite.title}</h2>
              <p>{t.invite.description}</p>
            </div>
          </div>
          {roles.data && sitesSettled ? (
            <InviteForm
              key={formVersion}
              organizationId={orgId}
              roles={roles.data}
              sites={siteOptions}
              onInvited={(invitation, message) => {
                upsert(invitation)
                setFormVersion((version) => version + 1)
                setFeedback({ tone: 'success', text: message })
              }}
            />
          ) : roles.status === 'error' ? (
            <Notice tone="error" action={{ label: t.retry, onClick: roles.reload }}>
              {t.invite.rolesError}
            </Notice>
          ) : (
            <LoadingState label={m.workspace.loading} />
          )}
        </section>

        <div className="members-lists">
          {feedback ? <Notice tone={feedback.tone}>{feedback.text}</Notice> : null}
          <PendingInvitations
            invitations={invitations}
            sites={sites.data ?? []}
            busyId={busyId}
            onResend={(invitation) => void resend(invitation)}
            onRevoke={(invitation) => void revoke(invitation)}
            m={m}
            locale={locale}
          />
          <MemberList members={members} m={m} />
        </div>
      </div>
    </div>
  )
}

type PendingProps = {
  invitations: RemoteData<Invitation[]>
  sites: Site[]
  busyId: string | null
  onResend: (invitation: Invitation) => void
  onRevoke: (invitation: Invitation) => void
  m: Messages
  locale: Locale
}

function PendingInvitations({ invitations, sites, busyId, onResend, onRevoke, m, locale }: PendingProps) {
  const t = m.members.pending
  const siteNames = new Map(sites.map((site) => [site.id, site.name]))
  const dateFormat = new Intl.DateTimeFormat(intlLocales[locale], { dateStyle: 'medium' })

  return (
    <section className="page-section" aria-labelledby="pending-heading">
      <div className="page-section__header">
        <h2 id="pending-heading">{t.title}</h2>
      </div>
      {invitations.data ? (
        invitations.data.length > 0 ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">{t.column.email}</th>
                  <th scope="col">{t.column.role}</th>
                  <th scope="col">{t.column.site}</th>
                  <th scope="col">{t.column.expires}</th>
                  <th scope="col" className="cell-actions">
                    {t.column.actions}
                  </th>
                </tr>
              </thead>
              <tbody>
                {invitations.data.map((invitation) => (
                  <tr key={invitation.id}>
                    <td className="members-email">{invitation.email}</td>
                    <td>{roleLabel(invitation.role, m.roles)}</td>
                    <td className={invitation.projectId ? undefined : 'cell-muted'}>
                      {invitation.projectId ? (siteNames.get(invitation.projectId) ?? t.unknownSite) : t.noSite}
                    </td>
                    <td className="data-mono">{formatInstant(dateFormat, invitation.expiresAt)}</td>
                    <td className="cell-actions">
                      <div className="button-row button-row--end">
                        <button
                          type="button"
                          className="button button--small"
                          disabled={busyId !== null}
                          aria-label={formatMessage(t.resendLabel, { email: invitation.email })}
                          onClick={() => onResend(invitation)}
                        >
                          {busyId === invitation.id ? t.working : t.resend}
                        </button>
                        <button
                          type="button"
                          className="button button--small button--danger"
                          disabled={busyId !== null}
                          aria-label={formatMessage(t.revokeLabel, { email: invitation.email })}
                          onClick={() => onRevoke(invitation)}
                        >
                          {t.revoke}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>{t.empty}</p>
          </div>
        )
      ) : invitations.status === 'error' ? (
        <Notice tone="error" action={{ label: m.members.retry, onClick: invitations.reload }}>
          {m.members.loadError}
        </Notice>
      ) : (
        <LoadingState label={m.workspace.loading} />
      )}
    </section>
  )
}

function MemberList({ members, m }: { members: RemoteData<Member[]>; m: Messages }) {
  const t = m.members.list

  return (
    <section className="page-section" aria-labelledby="members-heading">
      <div className="page-section__header">
        <h2 id="members-heading">{t.title}</h2>
      </div>
      {members.data ? (
        members.data.length > 0 ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">{t.column.name}</th>
                  <th scope="col">{t.column.email}</th>
                  <th scope="col">{t.column.role}</th>
                </tr>
              </thead>
              <tbody>
                {members.data.map((member) => (
                  <tr key={member.membershipId}>
                    <td className={member.fullName ? undefined : 'cell-muted'}>{member.fullName || t.unnamed}</td>
                    <td className="members-email">{member.email}</td>
                    <td>{roleLabel(member.role, m.roles)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>{t.empty}</p>
          </div>
        )
      ) : members.status === 'error' ? (
        <Notice tone="error" action={{ label: m.members.retry, onClick: members.reload }}>
          {m.members.loadError}
        </Notice>
      ) : (
        <LoadingState label={m.workspace.loading} />
      )}
    </section>
  )
}

function formatInstant(format: Intl.DateTimeFormat, instant: string): string {
  const date = new Date(instant)
  return Number.isNaN(date.getTime()) ? instant : format.format(date)
}
