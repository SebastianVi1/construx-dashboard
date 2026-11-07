import { useEffect, useState } from 'react'
import { z } from 'zod'
import { useRemoteData } from '../../components/data/useRemoteData'
import { Field, useForm } from '../../components/form'
import { Notice, SkeletonList } from '../../components/page'
import { formatMessage, useLocale } from '../../i18n'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { usePermissions } from '../permissions'
import { listMembers, type Member } from '../members/membersApi'
import {
  addCrewMember,
  createCrew,
  deleteCrew,
  listCrews,
  removeCrewMember,
  type Crew,
} from './crewsApi'
import './crews.css'

export function CrewsPage() {
  const { messages: m } = useLocale()
  const t = m.crews
  const { can } = usePermissions()
  const organization = useCurrentOrganization()
  const orgId = organization.id

  useEffect(() => {
    document.title = `${t.title} | Construx`
  }, [t.title])

  if (!can('VIEW_PLAN')) {
    return (
      <div className="page">
        <Notice>{t.forbidden}</Notice>
      </div>
    )
  }

  return <CrewsContent orgId={orgId} canManage={can('MANAGE_PLAN')} />
}

function CrewsContent({ orgId, canManage }: { orgId: string; canManage: boolean }) {
  const { messages: m } = useLocale()
  const t = m.crews

  const crews = useRemoteData(`${orgId}:crews`, () => listCrews(orgId))
  const members = useRemoteData(`${orgId}:members-list`, () => listMembers(orgId))

  const [showCreate, setShowCreate] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleCreate(name: string, leaderMembershipId: string) {
    setBusy(true)
    try {
      const crew = await createCrew(orgId, { name, leaderMembershipId })
      crews.update((prev) => [...(prev ?? []), crew])
      setShowCreate(false)
      setNotice(t.created)
    } catch {
      setNotice(t.error.generic)
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(crew: Crew) {
    if (!confirm(formatMessage(t.deleteBody, { name: crew.name }))) return
    try {
      await deleteCrew(orgId, crew.id)
      crews.update((prev) => prev?.filter((c) => c.id !== crew.id) ?? [])
      setNotice(t.deleted)
    } catch {
      setNotice(t.error.generic)
    }
  }

  async function handleAddMember(crewId: string, membershipId: string) {
    try {
      const updated = await addCrewMember(orgId, crewId, membershipId)
      crews.update((prev) => prev?.map((c) => (c.id === crewId ? updated : c)) ?? [])
      setNotice(t.memberAdded)
    } catch {
      setNotice(t.error.generic)
    }
  }

  async function handleRemoveMember(crewId: string, membershipId: string, leaderMembershipId: string) {
    if (membershipId === leaderMembershipId) {
      setNotice(t.error.leaderCannotBeRemoved)
      return
    }
    try {
      await removeCrewMember(orgId, crewId, membershipId)
      crews.update((prev) =>
        prev?.map((c) =>
          c.id === crewId
            ? { ...c, memberMembershipIds: c.memberMembershipIds.filter((id) => id !== membershipId) }
            : c,
        ) ?? [],
      )
      setNotice(t.memberRemoved)
    } catch {
      setNotice(t.error.generic)
    }
  }

  if (crews.status === 'loading') return <div className="page"><SkeletonList /></div>
  if (crews.status === 'error') return <div className="page"><Notice>{t.loadError}</Notice></div>

  const memberList = members.data ?? []
  const memberMap = new Map(memberList.map((m) => [m.membershipId, m]))

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__text">
          <h1>{t.title}</h1>
          <p>{t.description}</p>
        </div>
        {canManage && (
          <button type="button" className="button button--primary" onClick={() => setShowCreate(true)}>
            {t.add}
          </button>
        )}
      </header>

      {notice && <Notice tone="success">{notice}</Notice>}

      {showCreate && (
        <CreateCrewDialog
          members={memberList}
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
          busy={busy}
        />
      )}

      {crews.data?.length === 0 ? (
        <p className="crews-empty">{t.empty}</p>
      ) : (
        <ul className="crews-list">
          {crews.data?.map((crew) => (
            <li key={crew.id} className="crew-card">
              <div className="crew-card__header">
                <div>
                  <strong className="crew-card__name">{crew.name}</strong>
                  <span className="crew-card__leader">
                    {t.leader}: {memberMap.get(crew.leaderMembershipId)?.fullName ?? crew.leaderMembershipId}
                  </span>
                </div>
                {canManage && (
                  <button
                    type="button"
                    className="button button--danger button--sm"
                    onClick={() => handleDelete(crew)}
                  >
                    {t.delete}
                  </button>
                )}
              </div>

              <ul className="crew-members">
                {crew.memberMembershipIds.map((mid) => (
                  <li key={mid} className="crew-member">
                    <span>{memberMap.get(mid)?.fullName ?? mid}</span>
                    {canManage && mid !== crew.leaderMembershipId && (
                      <button
                        type="button"
                        className="crew-member__remove"
                        onClick={() => handleRemoveMember(crew.id, mid, crew.leaderMembershipId)}
                        aria-label={t.removeMember}
                      >
                        ×
                      </button>
                    )}
                  </li>
                ))}
                {crew.memberMembershipIds.length === 0 && (
                  <li className="crew-member crew-member--empty">{t.noMembers}</li>
                )}
              </ul>

              {canManage && (
                <AddMemberRow
                  crew={crew}
                  members={memberList}
                  onAdd={handleAddMember}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CreateCrewDialog({
  members,
  onSubmit,
  onCancel,
  busy,
}: {
  members: Member[]
  onSubmit: (name: string, leaderMembershipId: string) => void
  onCancel: () => void
  busy: boolean
}) {
  const { messages: m } = useLocale()
  const t = m.crews

  const leaderOptions = [
    { value: '', label: t.leaderPlaceholder },
    ...members.map((mem) => ({ value: mem.membershipId, label: mem.fullName ?? mem.email })),
  ]

  const schema = z.object({
    name: z.string().min(1, t.validation.nameRequired).max(120, t.validation.nameMax),
    leaderId: z.string().min(1, t.validation.leaderRequired),
  })

  const form = useForm({
    initialValues: { name: '', leaderId: '' },
    schema,
    onSubmit: async (values) => {
      onSubmit(values.name.trim(), values.leaderId)
    },
  })

  return (
    <div className="dialog-overlay">
      <form className="dialog" onSubmit={form.onSubmit} noValidate>
        <h2>{t.add}</h2>
        <Field
          config={{ name: 'name', label: t.name, placeholder: t.namePlaceholder }}
          value={form.values.name}
          error={form.errors.name}
          valid={form.valid.name}
          disabled={busy}
          onChange={(v) => form.onChange('name', v)}
          onBlur={() => form.onBlur('name')}
        />
        <Field
          config={{ name: 'leaderId', label: t.leader, type: 'select', options: leaderOptions }}
          value={form.values.leaderId}
          error={form.errors.leaderId}
          valid={form.valid.leaderId}
          disabled={busy}
          onChange={(v) => form.onChange('leaderId', v)}
          onBlur={() => form.onBlur('leaderId')}
        />
        <div className="dialog-actions">
          <button type="button" className="button" onClick={onCancel} disabled={busy}>
            {t.cancel}
          </button>
          <button type="submit" className="button button--primary" disabled={busy || form.isSubmitting}>
            {t.add}
          </button>
        </div>
      </form>
    </div>
  )
}

function AddMemberRow({
  crew,
  members,
  onAdd,
}: {
  crew: Crew
  members: Member[]
  onAdd: (crewId: string, membershipId: string) => void
}) {
  const { messages: m } = useLocale()
  const t = m.crews
  const available = members.filter((mem) => !crew.memberMembershipIds.includes(mem.membershipId))
  const [selected, setSelected] = useState('')

  if (available.length === 0) return null

  return (
    <div className="crew-add-member">
      <select value={selected} onChange={(e) => setSelected(e.target.value)}>
        <option value="">{t.addMember}</option>
        {available.map((mem) => (
          <option key={mem.membershipId} value={mem.membershipId}>
            {mem.fullName ?? mem.email}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="button button--sm"
        disabled={!selected}
        onClick={() => {
          if (selected) {
            onAdd(crew.id, selected)
            setSelected('')
          }
        }}
      >
        {t.addMember}
      </button>
    </div>
  )
}
