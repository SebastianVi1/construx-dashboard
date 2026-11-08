import { useEffect } from 'react'
import { useRemoteData } from '../../components/data/useRemoteData'
import { Notice, SkeletonList } from '../../components/page'
import { useLocale } from '../../i18n'
import { listMembers } from '../members/membersApi'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { usePermissions } from '../permissions'
import { CrewsSection } from './CrewsSection'

/** `/crews`: the crews on their own, for people who plan sites but do not manage the Team page. */
export function CrewsPage() {
  const { messages: m } = useLocale()
  const t = m.crews
  const { can } = usePermissions()
  const orgId = useCurrentOrganization().id
  const members = useRemoteData(can('VIEW_PLAN') ? `${orgId}:members` : null, () => listMembers(orgId))

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

  return (
    <div className="page">
      {members.data ? (
        <CrewsSection organizationId={orgId} members={members.data} canManage={can('MANAGE_PLAN')} />
      ) : members.status === 'error' ? (
        <Notice tone="error" action={{ label: m.members.retry, onClick: members.reload }}>
          {m.members.loadError}
        </Notice>
      ) : (
        <SkeletonList />
      )}
    </div>
  )
}
