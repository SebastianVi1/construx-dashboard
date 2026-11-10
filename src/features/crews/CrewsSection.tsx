import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { useRemoteData } from '../../components/data/useRemoteData'
import { Field, TEXT_LIMITS, useForm, type FieldConfig } from '../../components/form'
import { SearchIcon } from '../../components/icons'
import { ConfirmDialog, Modal } from '../../components/modal'
import { Notice, SkeletonList } from '../../components/page'
import { formatMessage, useLocale, type Messages } from '../../i18n'
import type { Member } from '../members/membersApi'
import { Avatar } from '../profile/Avatar'
import '../profile/profile.css'
import { addCrewMember, createCrew, deleteCrew, listCrews, removeCrewMember, type Crew } from './crewsApi'
import { makeCrewSchema } from './crewForm'
import { searchMembers } from './crewSearch'
import '../../components/form/form.css'
import './crews.css'

type Copy = Messages['crews']

/** Search results shown under a crew at once; a longer list means the query should be narrower. */
const MAX_RESULTS = 8

type CrewsSectionProps = {
  organizationId: string
  /** Active members of the company, the people a crew can be made of. */
  members: Member[]
  canManage: boolean
}

/**
 * Crews: named groups of company members with a leader, assigned together to a floor plan
 * zone. Lives on the Team page; the floor plan only lists them.
 */
export function CrewsSection({ organizationId, members, canManage }: CrewsSectionProps) {
  const { messages: m } = useLocale()
  const t = m.crews
  const crews = useRemoteData(`${organizationId}:crews`, () => listCrews(organizationId))
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Crew | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [busyCrewId, setBusyCrewId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const { hash } = useLocation()
  const ready = crews.status === 'ready'

  // Links from the floor plan land on `#crews`; the section only has its height once the list loads.
  useEffect(() => {
    if (ready && hash === '#crews') document.getElementById('crews')?.scrollIntoView({ block: 'start' })
  }, [ready, hash])

  const memberById = new Map(members.map((member) => [member.membershipId, member]))
  const nameOf = (membershipId: string) => {
    const member = memberById.get(membershipId)
    return member ? member.fullName || member.email : t.unknownMember
  }

  function replace(crew: Crew) {
    crews.update((list) => list.map((item) => (item.id === crew.id ? crew : item)))
  }

  /** Creates the crew, then adds the chosen people one by one; the leader is already in it. */
  async function create(name: string, leaderId: string, memberIds: string[]): Promise<string | null> {
    let crew: Crew
    try {
      crew = await createCrew(organizationId, { name, leaderMembershipId: leaderId })
    } catch {
      return t.error.generic
    }
    let failed = false
    for (const membershipId of memberIds) {
      if (membershipId === leaderId) continue
      try {
        crew = await addCrewMember(organizationId, crew.id, membershipId)
      } catch {
        failed = true
      }
    }
    crews.update((list) => [...list, crew])
    setCreating(false)
    setFeedback(
      failed
        ? { tone: 'error', text: formatMessage(t.createdPartly, { name: crew.name }) }
        : { tone: 'success', text: formatMessage(t.created, { name: crew.name }) },
    )
    return null
  }

  async function addMember(crew: Crew, membershipId: string) {
    setBusyCrewId(crew.id)
    setFeedback(null)
    try {
      replace(await addCrewMember(organizationId, crew.id, membershipId))
      setFeedback({ tone: 'success', text: formatMessage(t.memberAdded, { name: nameOf(membershipId), crew: crew.name }) })
    } catch {
      setFeedback({ tone: 'error', text: t.error.generic })
    } finally {
      setBusyCrewId(null)
    }
  }

  async function removeMember(crew: Crew, membershipId: string) {
    setBusyCrewId(crew.id)
    setFeedback(null)
    try {
      await removeCrewMember(organizationId, crew.id, membershipId)
      replace({ ...crew, memberMembershipIds: crew.memberMembershipIds.filter((id) => id !== membershipId) })
      setFeedback({ tone: 'success', text: formatMessage(t.memberRemoved, { name: nameOf(membershipId), crew: crew.name }) })
    } catch {
      setFeedback({ tone: 'error', text: t.error.generic })
    } finally {
      setBusyCrewId(null)
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    setDeleteError(null)
    try {
      await deleteCrew(organizationId, deleting.id)
      crews.update((list) => list.filter((item) => item.id !== deleting.id))
      setFeedback({ tone: 'success', text: formatMessage(t.deleted, { name: deleting.name }) })
      setDeleting(null)
    } catch {
      setDeleteError(t.error.generic)
    }
  }

  return (
    <section id="crews" className="page-section" aria-labelledby="crews-heading">
      <div className="page-section__header">
        <div>
          <h2 id="crews-heading">{t.title}</h2>
          <p>{t.description}</p>
        </div>
        {canManage ? (
          <button
            type="button"
            className="button button--primary"
            disabled={members.length === 0}
            onClick={() => setCreating(true)}
          >
            {t.add}
          </button>
        ) : null}
      </div>

      {feedback ? <Notice tone={feedback.tone}>{feedback.text}</Notice> : null}

      {crews.data ? (
        crews.data.length > 0 ? (
          <ul className="crews-list">
            {crews.data.map((crew) => (
              <CrewCard
                key={crew.id}
                t={t}
                crew={crew}
                members={members}
                nameOf={nameOf}
                canManage={canManage}
                busy={busyCrewId === crew.id}
                onAdd={(membershipId) => void addMember(crew, membershipId)}
                onRemove={(membershipId) => void removeMember(crew, membershipId)}
                onDelete={() => {
                  setDeleteError(null)
                  setDeleting(crew)
                }}
              />
            ))}
          </ul>
        ) : (
          <div className="empty-state">
            <p>{canManage ? t.emptyManage : t.empty}</p>
          </div>
        )
      ) : crews.status === 'error' ? (
        <Notice tone="error" action={{ label: m.members.retry, onClick: crews.reload }}>
          {t.loadError}
        </Notice>
      ) : (
        <SkeletonList />
      )}

      {creating ? (
        <CreateCrewDialog t={t} members={members} onSubmit={create} onClose={() => setCreating(false)} />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title={t.deleteTitle}
          body={formatMessage(t.deleteBody, { name: deleting.name })}
          confirmLabel={t.deleteConfirm}
          pendingLabel={t.deleting}
          cancelLabel={t.cancel}
          error={deleteError}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </section>
  )
}

type CrewCardProps = {
  t: Copy
  crew: Crew
  members: Member[]
  nameOf: (membershipId: string) => string
  canManage: boolean
  busy: boolean
  onAdd: (membershipId: string) => void
  onRemove: (membershipId: string) => void
  onDelete: () => void
}

function CrewCard({ t, crew, members, nameOf, canManage, busy, onAdd, onRemove, onDelete }: CrewCardProps) {
  const [query, setQuery] = useState('')
  const available = members.filter((member) => !crew.memberMembershipIds.includes(member.membershipId))
  const matches = query.trim() ? searchMembers(available, query) : []
  // The leader is listed first, the rest in the order they joined.
  const ordered = [
    crew.leaderMembershipId,
    ...crew.memberMembershipIds.filter((id) => id !== crew.leaderMembershipId),
  ]

  return (
    <li className="crew-card">
      <div className="crew-card__header">
        <div>
          <h3 className="crew-card__name">{crew.name}</h3>
          <span className="crew-card__meta">
            {formatMessage(t.memberCount, { count: crew.memberMembershipIds.length })}
          </span>
        </div>
        {canManage ? (
          <button type="button" className="button button--small button--danger" disabled={busy} onClick={onDelete}>
            {t.delete}
          </button>
        ) : null}
      </div>

      <ul className="crew-members" aria-label={formatMessage(t.membersOf, { name: crew.name })}>
        {ordered.map((membershipId) => {
          const isLeader = membershipId === crew.leaderMembershipId
          const name = nameOf(membershipId)
          const member = members.find((item) => item.membershipId === membershipId)
          return (
            <li key={membershipId} className="crew-member">
              <Avatar fullName={member?.fullName ?? null} email={member?.email} avatarUrl={member?.avatarUrl} decorative />
              <span className="crew-member__name">{name}</span>
              {isLeader ? <span className="badge" data-tone="accent">{t.leader}</span> : null}
              {canManage && !isLeader ? (
                <button
                  type="button"
                  className="crew-member__remove"
                  disabled={busy}
                  aria-label={formatMessage(t.removeMemberLabel, { name, crew: crew.name })}
                  title={t.removeMember}
                  onClick={() => onRemove(membershipId)}
                >
                  ×
                </button>
              ) : null}
            </li>
          )
        })}
      </ul>

      {canManage && available.length > 0 ? (
        <form
          className="crew-add"
          role="search"
          onSubmit={(event) => {
            // Enter adds the first match, so typing a name and pressing Enter is enough.
            event.preventDefault()
            if (matches[0] && !busy) onAdd(matches[0].membershipId)
          }}
        >
          <PeopleSearch
            value={query}
            label={formatMessage(t.addMemberTo, { crew: crew.name })}
            placeholder={t.searchPeople}
            onChange={setQuery}
          />
          {query.trim() ? (
            matches.length > 0 ? (
              <>
                <ul className="crew-results">
                  {matches.slice(0, MAX_RESULTS).map((member) => (
                    <li key={member.membershipId}>
                      <button
                        type="button"
                        className="crew-result"
                        disabled={busy}
                        aria-label={formatMessage(t.addPersonLabel, { name: member.fullName || member.email, crew: crew.name })}
                        onClick={() => onAdd(member.membershipId)}
                      >
                        <span className="crew-result__plus" aria-hidden="true">+</span>
                        <Avatar fullName={member.fullName} email={member.email} avatarUrl={member.avatarUrl} decorative />
                        <span className="crew-result__text">
                          <span className="crew-result__name">{member.fullName || member.email}</span>
                          {member.fullName ? <span className="crew-result__email">{member.email}</span> : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {matches.length > MAX_RESULTS ? (
                  <p className="crew-search__note">
                    {formatMessage(t.moreResults, { count: matches.length - MAX_RESULTS })}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="crew-search__note">{t.noMatches}</p>
            )
          ) : null}
        </form>
      ) : null}
    </li>
  )
}

type CreateCrewDialogProps = {
  t: Copy
  members: Member[]
  /** Resolves with an error message to show, or null when done. */
  onSubmit: (name: string, leaderId: string, memberIds: string[]) => Promise<string | null>
  onClose: () => void
}

function CreateCrewDialog({ t, members, onSubmit, onClose }: CreateCrewDialogProps) {
  const [picked, setPicked] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const form = useForm({
    initialValues: { name: '', leader: '' },
    schema: makeCrewSchema(t.validation),
    onSubmit: async (values) => {
      setError(await onSubmit(values.name.trim(), values.leader, picked))
    },
  })
  const busy = form.isSubmitting
  const leader = form.values.leader
  const shown = searchMembers(members, query)
  const chosen = new Set([...picked, leader].filter(Boolean)).size

  function toggle(membershipId: string) {
    setPicked((list) => (list.includes(membershipId) ? list.filter((id) => id !== membershipId) : [...list, membershipId]))
  }

  const fields: FieldConfig[] = [
    { name: 'name', label: t.name, placeholder: t.namePlaceholder, autoComplete: 'off', maxLength: TEXT_LIMITS.crewName },
    {
      name: 'leader',
      label: t.leader,
      type: 'select',
      options: [
        { value: '', label: t.leaderPlaceholder },
        ...members.map((member) => ({ value: member.membershipId, label: member.fullName || member.email })),
      ],
    },
  ]

  return (
    <Modal title={t.add} description={t.createDescription} onClose={onClose}>
      <form className="crew-form" noValidate onSubmit={form.onSubmit} aria-busy={busy}>
        {fields.map((field) => (
          <Field
            key={field.name}
            config={field}
            value={form.values[field.name]}
            error={form.errors[field.name]}
            valid={form.valid[field.name]}
            disabled={busy}
            onChange={(value) => form.onChange(field.name, value)}
            onBlur={() => form.onBlur(field.name)}
          />
        ))}

        <fieldset className="crew-form__people" disabled={busy}>
          <legend className="form-field__label">{t.members}</legend>
          <p className="form-field__hint">
            {t.membersHint} {formatMessage(t.selectedCount, { count: chosen })}
          </p>
          <PeopleSearch value={query} label={t.searchPeople} placeholder={t.searchPeople} onChange={setQuery} />
          {shown.length === 0 ? <p className="crew-search__note">{t.noMatches}</p> : null}
          <ul className="crew-form__options" hidden={shown.length === 0}>
            {shown.map((member) => {
              const isLeader = member.membershipId === leader
              return (
                <li key={member.membershipId}>
                  <label className="crew-form__option">
                    <input
                      type="checkbox"
                      checked={isLeader || picked.includes(member.membershipId)}
                      disabled={isLeader}
                      onChange={() => toggle(member.membershipId)}
                    />
                    <Avatar fullName={member.fullName} email={member.email} avatarUrl={member.avatarUrl} decorative />
                    <span>{member.fullName || member.email}</span>
                    {isLeader ? <span className="badge" data-tone="accent">{t.leader}</span> : null}
                  </label>
                </li>
              )
            })}
          </ul>
        </fieldset>

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="button-row button-row--end modal-actions">
          <button type="button" className="button" onClick={onClose} disabled={busy}>
            {t.cancel}
          </button>
          <button type="submit" className="button button--primary" disabled={busy} aria-busy={busy}>
            {busy ? t.creating : t.add}
          </button>
        </div>
      </form>
    </Modal>
  )
}

type PeopleSearchProps = {
  value: string
  label: string
  placeholder: string
  onChange: (value: string) => void
}

function PeopleSearch({ value, label, placeholder, onChange }: PeopleSearchProps) {
  return (
    <div className="crew-search">
      <SearchIcon className="crew-search__icon" aria-hidden="true" />
      <input
        type="search"
        className="form-field__control crew-search__input"
        aria-label={label}
        placeholder={placeholder}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
