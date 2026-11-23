import { NavLink } from 'react-router'
import { useLocale } from '../../i18n'
import { peopleChildren } from '../organizations/workspaceNav'
import { usePermissions } from '../permissions'
import { peopleAccess } from './peopleAccess'
import '../../components/filter/filter-tabs.css'
import './roles.css'

/**
 * Members | Roles & permissions strip at the top of both People pages, on
 * phones and tablets (the desktop sidebar lists the sub-pages instead). Hidden
 * when the caller may open just one of them (roles contract §8.1).
 */
export function PeopleTabs() {
  const { messages: m } = useLocale()
  const { can } = usePermissions()
  const children = peopleChildren(peopleAccess(can))
  if (children.length < 2) return null

  return (
    <nav className="filter-tabs people-tabs" aria-label={m.workspace.peoplePages}>
      {children.map((child) => (
        <NavLink key={child.key} className="filter-tabs__tab" to={child.to} end={child.key === 'members'}>
          {m.workspace[child.key]}
        </NavLink>
      ))}
    </nav>
  )
}
