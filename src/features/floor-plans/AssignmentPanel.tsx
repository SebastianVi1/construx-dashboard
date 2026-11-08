import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { formatMessage, useLocale } from '../../i18n'
import { usePermissions } from '../permissions'
import { listMembers } from '../members/membersApi'
import type { Member } from '../members/membersApi'
import { listCrews, listEquipment } from '../crews/crewsApi'
import type { Crew, Equipment } from '../crews/crewsApi'
import type { DraggableResource } from './zoneAssignmentsApi'

type Tab = 'people' | 'crews' | 'equipment'

interface AssignmentPanelProps {
  organizationId: string
  onDragStart: (resource: DraggableResource) => void
  onDragEnd: () => void
}

/** Up to two initials for the chip's badge: "Ana López" → "AL", "ana@x.io" → "A". */
function initials(name: string): string {
  const words = name.split('@')[0].split(/[\s._-]+/).filter(Boolean)
  return words
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}

export function AssignmentPanel({ organizationId, onDragStart, onDragEnd }: AssignmentPanelProps) {
  const { messages: m } = useLocale()
  const t = m.floorPlans.assignments
  const { can } = usePermissions()
  // Crews are managed on the Team page; planners without it have the crews page of their own.
  const crewsHref = can('MANAGE_MEMBERS') ? '/members#crews' : '/crews'

  const [tab, setTab] = useState<Tab>('people')
  const [members, setMembers] = useState<Member[]>([])
  const [crews, setCrews] = useState<Crew[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    Promise.all([
      listMembers(organizationId),
      listCrews(organizationId),
      listEquipment(organizationId, true),
    ])
      .then(([ms, cs, eq]) => {
        setMembers(ms)
        setCrews(cs)
        setEquipment(eq)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [organizationId])

  function handleDragStart(resource: DraggableResource, e: React.DragEvent) {
    e.dataTransfer.setData('application/json', JSON.stringify(resource))
    e.dataTransfer.effectAllowed = 'move'
    onDragStart(resource)
  }

  return (
    <aside className="assignment-panel" aria-labelledby="assignment-panel-title">
      <header className="fp-panel-header">
        <h2 id="assignment-panel-title" className="fp-panel-header__title">{t.panelTitle}</h2>
        <p className="fp-panel-header__hint">{t.dragHint}</p>
      </header>

      <div className="fp-segmented" role="tablist">
        {(['people', 'crews', 'equipment'] as Tab[]).map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            type="button"
            className="fp-segmented__option"
            onClick={() => setTab(key)}
          >
            {key === 'people' ? t.tabPeople : key === 'crews' ? t.tabCrews : t.tabEquipment}
          </button>
        ))}
      </div>

      <div className="assignment-panel__list" role="tabpanel">
        {loading ? (
          <p className="assignment-panel__empty">{m.floorPlans.loading}</p>
        ) : tab === 'people' ? (
          members.length === 0 ? (
            <p className="assignment-panel__empty">{t.emptyPeople}</p>
          ) : (
            members.map((member) => (
              <div
                key={member.membershipId}
                className="assignment-chip"
                draggable
                onDragStart={(e) =>
                  handleDragStart(
                    {
                      type: 'membership',
                      id: member.membershipId,
                      name: member.fullName ?? member.email,
                    },
                    e,
                  )
                }
                onDragEnd={onDragEnd}
              >
                <span className="assignment-chip__avatar" aria-hidden>{initials(member.fullName ?? member.email)}</span>
                <span className="assignment-chip__text">
                  <span className="assignment-chip__name">{member.fullName ?? member.email}</span>
                  <span className="assignment-chip__meta">{member.role.name}</span>
                </span>
              </div>
            ))
          )
        ) : tab === 'crews' ? (
          crews.length === 0 ? (
            <p className="assignment-panel__empty">
              {t.emptyCrews}
              {can('MANAGE_PLAN') ? (
                <>
                  {' '}
                  <Link to={crewsHref}>{t.createCrews}</Link>
                </>
              ) : null}
            </p>
          ) : (
            crews.map((crew) => (
              <div
                key={crew.id}
                className="assignment-chip"
                draggable
                onDragStart={(e) =>
                  handleDragStart({ type: 'crew', id: crew.id, name: crew.name }, e)
                }
                onDragEnd={onDragEnd}
              >
                <span className="assignment-chip__avatar assignment-chip__avatar--crew" aria-hidden>
                  {crew.memberMembershipIds.length}
                </span>
                <span className="assignment-chip__text">
                  <span className="assignment-chip__name">{crew.name}</span>
                  <span className="assignment-chip__meta">
                    {formatMessage(t.crewMembers, { count: crew.memberMembershipIds.length })}
                  </span>
                </span>
              </div>
            ))
          )
        ) : equipment.length === 0 ? (
          <p className="assignment-panel__empty">{t.emptyEquipment}</p>
        ) : (
          equipment.map((eq) => (
            <div
              key={eq.id}
              className="assignment-chip"
              draggable
              onDragStart={(e) =>
                handleDragStart(
                  { type: 'equipment', id: eq.id, name: `${eq.type} — ${eq.identifier}` },
                  e,
                )
              }
              onDragEnd={onDragEnd}
            >
              <span className="assignment-chip__avatar assignment-chip__avatar--equipment" aria-hidden>
                {initials(eq.type)}
              </span>
              <span className="assignment-chip__text">
                <span className="assignment-chip__name">{eq.type}</span>
                <span className="assignment-chip__meta">{eq.identifier}</span>
              </span>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}
