import { useEffect, useState } from 'react'
import { useLocale } from '../../i18n'
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

export function AssignmentPanel({ organizationId, onDragStart, onDragEnd }: AssignmentPanelProps) {
  const { messages: m } = useLocale()
  const t = m.floorPlans.assignments

  const [tab, setTab] = useState<Tab>('people')
  const [members, setMembers] = useState<Member[]>([])
  const [crews, setCrews] = useState<Crew[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
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
    <aside className="assignment-panel">
      <h2 className="assignment-panel__title">{t.panelTitle}</h2>
      <p className="assignment-panel__hint">{t.dragHint}</p>

      <div className="assignment-panel__tabs" role="tablist">
        {(['people', 'crews', 'equipment'] as Tab[]).map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            type="button"
            className={`assignment-panel__tab${tab === key ? ' assignment-panel__tab--active' : ''}`}
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
                <span className="assignment-chip__name">{member.fullName ?? member.email}</span>
                <span className="assignment-chip__meta">{member.role.name}</span>
              </div>
            ))
          )
        ) : tab === 'crews' ? (
          crews.length === 0 ? (
            <p className="assignment-panel__empty">{t.emptyCrews}</p>
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
                <span className="assignment-chip__name">{crew.name}</span>
                <span className="assignment-chip__meta">{crew.memberMembershipIds.length} members</span>
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
              <span className="assignment-chip__name">{eq.type}</span>
              <span className="assignment-chip__meta">{eq.identifier}</span>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}
