import { useId, useState } from 'react'
import { useRemoteData } from '../../components/data/useRemoteData'
import { Field } from '../../components/form'
import { Notice, SkeletonForm, SkeletonList } from '../../components/page'
import { useLocale, type Locale } from '../../i18n'
import { listMembers, type Member } from '../members/membersApi'
import { roleLabel } from '../permissions'
import { Avatar } from '../profile/Avatar'
import { RoleSelect } from './RoleSelect'
import { addPersonCandidates } from './roleAssignment'
import { useRoles } from './rolesCache'
import type { RoleSummary } from './rolesApi'
import { useRoleMove, type MoveFeedback } from './useRoleMove'
import '../../components/form/form.css'
import '../profile/profile.css'
import '../members/members.css'
import './people.css'

type PeopleTabProps = {
  organizationId: string
  role: RoleSummary
  myMembershipId: string | null
  /** A member moved into or out of the role: the page refreshes its counts. */
  onChanged: () => void
}

/** Holders of the role: active members first, then suspended ones (both count as holding it, §5.1). */
function loadHolders(organizationId: string, code: string): Promise<Member[]> {
  return Promise.all([
    listMembers(organizationId, { role: code }),
    listMembers(organizationId, { status: 'SUSPENDED', role: code }),
  ]).then(([active, suspended]) => [...active, ...suspended])
}

/**
 * A role page's People tab (roles contract §8.3, needs `MANAGE_MEMBERS`): who
 * holds the role, each with a role dropdown, and "Add person" to move a member in.
 */
export function PeopleTab({ organizationId, role, myMembershipId, onChanged }: PeopleTabProps) {
  const { messages: m, locale } = useLocale()
  const t = m.roles.people
  const headingId = useId()
  const holders = useRemoteData(`${organizationId}:members:role:${role.code}`, () =>
    loadHolders(organizationId, role.code),
  )
  // Same keys as the Members page, so both show the same lists.
  const roles = useRoles(organizationId)
  const members = useRemoteData(role.assignable ? `${organizationId}:members` : null, () =>
    listMembers(organizationId),
  )
  const [feedback, setFeedback] = useState<MoveFeedback | null>(null)
  // Into this role from "Add person", out of it from a row.
  const { move, pending } = useRoleMove(organizationId, {
    onMoved: (moved) => {
      holders.update((list) =>
        moved.role.code === role.code
          ? [...list.filter((item) => item.membershipId !== moved.membershipId), moved]
          : list.filter((item) => item.membershipId !== moved.membershipId),
      )
      members.update((list) => list.map((item) => (item.membershipId === moved.membershipId ? moved : item)))
      onChanged()
    },
    onFeedback: setFeedback,
  })

  const nameOf = (member: Member) => member.fullName || member.email

  return (
    <section className="page-section" aria-labelledby={headingId}>
      <div className="page-section__header">
        <div>
          <h2 id={headingId}>{t.title}</h2>
          <p>{t.description}</p>
        </div>
      </div>

      {feedback ? <Notice tone={feedback.tone}>{feedback.text}</Notice> : null}

      {holders.data ? (
        holders.data.length > 0 ? (
          <div className="member-rows">
            {holders.data.map((member) => {
              const isSelf = member.membershipId === myMembershipId
              return (
                <div key={member.membershipId} className="member-row">
                  <Avatar fullName={member.fullName} email={member.email} avatarUrl={member.avatarUrl} decorative />
                  <div className="member-info">
                    <span className={`member-name${member.fullName ? '' : ' member-name--unnamed'}`}>
                      {member.fullName || m.members.list.unnamed}
                    </span>
                    <span className="member-email">{member.email}</span>
                  </div>
                  <div className="member-row__end">
                    {member.status === 'SUSPENDED' ? (
                      <span className="badge" data-tone="muted">
                        {t.suspended}
                      </span>
                    ) : null}
                    {isSelf ? (
                      <>
                        <span className="role-people__you">{t.you}</span>
                        <span className="role-people__role">{roleLabel(member.role, locale)}</span>
                      </>
                    ) : (
                      <RoleSelect
                        member={member}
                        roles={roles.data}
                        myMembershipId={myMembershipId}
                        name={nameOf(member)}
                        pendingCode={pending?.membershipId === member.membershipId ? pending.roleCode : null}
                        disabled={pending !== null}
                        onChange={(roleCode) => void move(member, roleCode)}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="empty-state">
            <p>{t.empty}</p>
          </div>
        )
      ) : holders.status === 'error' ? (
        <Notice tone="error" action={{ label: m.roles.retry, onClick: holders.reload }}>
          {t.loadError}
        </Notice>
      ) : (
        <SkeletonList rows={4} />
      )}

      {role.assignable ? (
        <AddPerson
          role={role}
          members={members.data}
          membersFailed={members.status === 'error'}
          roles={roles.data}
          myMembershipId={myMembershipId}
          busy={pending !== null}
          locale={locale}
          onAdd={(member) => void move(member, role.code)}
          onRetry={members.reload}
        />
      ) : (
        <p className="role-people-add role-people-add__hint">{t.add.notAssignable}</p>
      )}
    </section>
  )
}

type AddPersonProps = {
  role: RoleSummary
  members: Member[] | undefined
  membersFailed: boolean
  roles: RoleSummary[] | undefined
  myMembershipId: string | null
  busy: boolean
  locale: Locale
  onAdd: (member: Member) => void
  onRetry: () => void
}

/** "Add person": members whose current role and this role are both assignable by the caller. */
function AddPerson({ role, members, membersFailed, roles, myMembershipId, busy, locale, onAdd, onRetry }: AddPersonProps) {
  const { messages: m } = useLocale()
  const t = m.roles.people.add
  const [chosen, setChosen] = useState('')

  if (!members || !roles) {
    if (membersFailed) {
      return (
        <div className="role-people-add">
          <Notice tone="error" action={{ label: m.roles.retry, onClick: onRetry }}>
            {t.loadError}
          </Notice>
        </div>
      )
    }
    return (
      <div className="role-people-add">
        <SkeletonForm fields={1} />
      </div>
    )
  }

  const candidates = addPersonCandidates(members, role, roles, myMembershipId)
  if (candidates.length === 0) return <p className="role-people-add role-people-add__hint">{t.none}</p>
  const selected = candidates.find((member) => member.membershipId === chosen) ?? null

  return (
    <form
      className="role-people-add"
      onSubmit={(event) => {
        event.preventDefault()
        if (!selected || busy) return
        onAdd(selected)
        setChosen('')
      }}
    >
      <div className="role-people-add__row">
        <Field
          config={{
            name: `add-person-${role.code}`,
            label: t.label,
            type: 'select',
            options: [
              { value: '', label: t.placeholder },
              ...candidates.map((member) => ({
                value: member.membershipId,
                label: `${member.fullName || m.members.list.unnamed} (${member.email}), ${roleLabel(member.role, locale)}`,
              })),
            ],
          }}
          value={selected?.membershipId ?? ''}
          disabled={busy}
          onChange={setChosen}
        />
        <button type="submit" className="button" disabled={busy || !selected} aria-busy={busy}>
          {busy ? t.pending : t.submit}
        </button>
      </div>
    </form>
  )
}
