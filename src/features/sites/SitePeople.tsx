import { useId, useState } from 'react'
import { useRemoteData, type RemoteData } from '../../components/data/useRemoteData'
import { LoadingState, Notice } from '../../components/page'
import { formatMessage, useLocale } from '../../i18n'
import { listMembers, type Member } from '../members/membersApi'
import { roleLabel } from '../permissions'
import { AuthApiError } from '../auth/authApi'
import { assignableMembers } from './siteHelpers'
import { accessErrorKind, assignToSite, removeFromSite, type AccessErrorKind, type SiteAccess } from './sitesApi'

type SitePeopleProps = {
  organizationId: string
  siteId: string
  people: RemoteData<SiteAccess[]>
  canManage: boolean
  myMembershipId: string | null
}

/** People on a site: list for everyone who can view it; add and remove with MANAGE_PROJECT. */
export function SitePeople({ organizationId, siteId, people, canManage, myMembershipId }: SitePeopleProps) {
  const { messages: m } = useLocale()
  const t = m.sites.people
  const headingId = useId()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [errorKind, setErrorKind] = useState<AccessErrorKind | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const nameOf = (person: { fullName: string | null }) => person.fullName || t.unnamed

  async function remove(person: SiteAccess) {
    setBusyId(person.accessId)
    setErrorKind(null)
    setDone(null)
    try {
      await removeFromSite(organizationId, siteId, person.accessId)
      people.update((list) => list.filter((item) => item.accessId !== person.accessId))
      setDone(formatMessage(t.removed, { name: nameOf(person) }))
    } catch (error) {
      setErrorKind(accessErrorKind(error))
    } finally {
      setBusyId(null)
    }
  }

  function added(person: SiteAccess) {
    people.update((list) => [...list.filter((item) => item.accessId !== person.accessId), person])
    setErrorKind(null)
    setDone(formatMessage(t.added, { name: nameOf(person) }))
  }

  return (
    <section className="page-section" aria-labelledby={headingId}>
      <div className="page-section__header">
        <div>
          <h2 id={headingId}>{t.title}</h2>
          <p>{t.description}</p>
        </div>
      </div>

      {errorKind ? <Notice tone="error">{t.error[errorKind]}</Notice> : done ? <Notice tone="success">{done}</Notice> : null}

      {people.data ? (
        people.data.length > 0 ? (
          <div className="table-scroll">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th scope="col">{t.column.name}</th>
                  <th scope="col">{t.column.role}</th>
                  {canManage ? (
                    <th scope="col" className="cell-actions">
                      {t.column.actions}
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {people.data.map((person) => (
                  <tr key={person.accessId}>
                    <td className={person.fullName ? undefined : 'cell-muted'}>
                      {nameOf(person)}
                      {person.membershipId === myMembershipId ? <span className="person-you">{t.you}</span> : null}
                    </td>
                    <td>{roleLabel(person.role, m.roles)}</td>
                    {canManage ? (
                      <td className="cell-actions">
                        <button
                          type="button"
                          className="button button--small button--danger"
                          disabled={busyId !== null}
                          aria-label={formatMessage(t.removeLabel, { name: nameOf(person) })}
                          onClick={() => void remove(person)}
                        >
                          {busyId === person.accessId ? t.removing : t.remove}
                        </button>
                      </td>
                    ) : null}
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
      ) : people.status === 'error' ? (
        <Notice tone="error" action={{ label: m.sites.load.retry, onClick: people.reload }}>
          {t.loadError}
        </Notice>
      ) : (
        <LoadingState label={t.loading} />
      )}

      {canManage ? (
        <AssignPerson
          organizationId={organizationId}
          siteId={siteId}
          people={people.data ?? []}
          onAdded={added}
          onFailed={(kind) => {
            setDone(null)
            setErrorKind(kind)
          }}
        />
      ) : null}
    </section>
  )
}

type AssignPersonProps = {
  organizationId: string
  siteId: string
  people: SiteAccess[]
  onAdded: (person: SiteAccess) => void
  onFailed: (kind: AccessErrorKind) => void
}

/** Member picker fed by `GET /members` (needs MANAGE_MEMBERS on the server). */
function AssignPerson({ organizationId, siteId, people, onAdded, onFailed }: AssignPersonProps) {
  const { messages: m } = useLocale()
  const t = m.sites.people
  const selectId = useId()
  const members = useRemoteData(`${organizationId}:members`, () => listMembers(organizationId))
  const [chosen, setChosen] = useState('')
  const [busy, setBusy] = useState(false)

  if (!members.data) {
    if (members.status !== 'error') return <LoadingState label={m.workspace.loading} />
    const forbidden = members.error instanceof AuthApiError && members.error.status === 403
    return <Notice>{forbidden ? t.membersForbidden : t.membersError}</Notice>
  }

  const candidates = assignableMembers(members.data, people)
  if (candidates.length === 0) return <Notice>{t.allAssigned}</Notice>
  const selected = candidates.some((member) => member.membershipId === chosen) ? chosen : ''

  async function assign() {
    if (!selected || busy) return
    setBusy(true)
    try {
      onAdded(await assignToSite(organizationId, siteId, selected))
      setChosen('')
    } catch (error) {
      onFailed(accessErrorKind(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="assign-person"
      onSubmit={(event) => {
        event.preventDefault()
        void assign()
      }}
    >
      <label className="assign-person__label" htmlFor={selectId}>
        {t.assignLabel}
      </label>
      <div className="assign-person__row">
        <span className="filter-select assign-person__select">
          <select id={selectId} value={selected} onChange={(event) => setChosen(event.target.value)} disabled={busy}>
            <option value="">{t.assignPlaceholder}</option>
            {candidates.map((member) => (
              <option key={member.membershipId} value={member.membershipId}>
                {memberOptionLabel(member, t.unnamed, m.roles)}
              </option>
            ))}
          </select>
        </span>
        <button type="submit" className="button" disabled={busy || !selected}>
          {busy ? t.assigning : t.assign}
        </button>
      </div>
    </form>
  )
}

function memberOptionLabel(member: Member, unnamed: string, roles: Record<string, string>): string {
  return `${member.fullName || unnamed} (${member.email}), ${roleLabel(member.role, roles)}`
}
