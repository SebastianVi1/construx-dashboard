import { Suspense, useEffect, useRef, useState, type MouseEvent } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { DocumentIcon, MaterialsIcon, SitesIcon, SpreadsheetIcon, TasksIcon, TeamIcon } from '../../components/icons'
import { SkeletonList, Notice } from '../../components/page'
import { useLocale } from '../../i18n'
import { GuideHeaderButton, GuideNavButton, GuideProvider } from '../guide'
import { PermissionsProvider, usePermissions } from '../permissions'
import { seesWorkbooks } from '../excel/excelAccess'
import { FinanceIcon } from '../org-finance/FinanceIcon'
import { seesOrgFinance } from '../org-finance/orgFinanceAccess'
import { hasPermission } from '../permissions/landing'
import { peopleAccess } from '../roles/peopleAccess'
import { useCurrentOrganization } from './organizations-context'
import { WorkspaceHeader } from './WorkspaceHeader'
import { workspaceNavItems, type WorkspaceNavItem, type WorkspaceNavLink } from './workspaceNav'
import './workspace.css'

const MAIN_ID = 'workspace-main'

const navIcons: Record<WorkspaceNavItem['key'], typeof SitesIcon> = {
  finance: FinanceIcon,
  sites: SitesIcon,
  myTasks: TasksIcon,
  prices: MaterialsIcon,
  excel: SpreadsheetIcon,
  documents: DocumentIcon,
  people: TeamIcon,
  // Members and roles only appear under People; they share its icon.
  members: TeamIcon,
  roles: TeamIcon,
}

/** Members is the group's root path: it must not stay highlighted on the roles pages below it. */
const endsAtItself = (item: WorkspaceNavLink) => item.key === 'members'

/**
 * Frame of the company workspace: header across the top, navigation beside
 * the routed page (a bottom tab bar on phones). Sits inside `OrganizationGate`.
 * The header stays mounted across a company switch; everything below it
 * reloads the caller's permissions for the selected company.
 */
export function WorkspaceLayout() {
  const organization = useCurrentOrganization()
  const { messages: m } = useLocale()
  const [guideSlot, setGuideSlot] = useState<HTMLDivElement | null>(null)

  const skipToMain = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    document.getElementById(MAIN_ID)?.focus()
  }

  return (
    <div className="workspace">
      <a className="skip-link" href={`#${MAIN_ID}`} onClick={skipToMain}>
        {m.workspace.skipToContent}
      </a>
      <WorkspaceHeader guideSlotRef={setGuideSlot} />
      <PermissionsProvider key={organization.id} organizationId={organization.id}>
        {/* Inside the per-Company boundary: a switch remounts the guide for the new Company. */}
        <GuideProvider organizationId={organization.id}>
          <WorkspaceBody guideSlot={guideSlot} />
        </GuideProvider>
      </PermissionsProvider>
    </div>
  )
}

function WorkspaceBody({ guideSlot }: { guideSlot: HTMLDivElement | null }) {
  const { messages: m } = useLocale()
  const t = m.workspace
  const { status, access, can, reload } = usePermissions()
  const { pathname } = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const lastPath = useRef(pathname)

  // Move focus to the new page so keyboard and screen reader users land on it.
  useEffect(() => {
    if (lastPath.current === pathname) return
    lastPath.current = pathname
    mainRef.current?.focus()
  }, [pathname])

  const items = workspaceNavItems({
    seesFinance: seesOrgFinance(access),
    seesOwnTasks: hasPermission(access, 'VIEW_ACTIVITY') || hasPermission(access, 'MANAGE_ACTIVITY'),
    seesPrices: can('VIEW_PRICES'),
    seesBudget: seesWorkbooks(access),
    ...peopleAccess(can),
  })

  const link = (prefix: 'workspace-nav' | 'workspace-tabbar', item: WorkspaceNavItem, className = '') => {
    const Icon = navIcons[item.key]
    return (
      <NavLink className={`${prefix}__link${className}`} to={item.to} end={'children' in item ? false : endsAtItself(item)}>
        <Icon className={`${prefix}__icon`} />
        <span className={`${prefix}__label`}>{t[item.key]}</span>
      </NavLink>
    )
  }

  // Sidebar: a group is a heading over indented sub-links. The tablet rail is too
  // narrow for that, so it shows the group as one link, like the phone tab bar,
  // and the pages carry the sub-page strip (PeopleTabs).
  const PeopleIcon = navIcons.people
  const sidebarLinks = items.map((item) =>
    'children' in item ? (
      <li key={item.key} className="workspace-nav__item workspace-nav__group">
        {link('workspace-nav', item, ' workspace-nav__group-link')}
        <span className="workspace-nav__group-label" id={`workspace-nav-${item.key}`}>
          <PeopleIcon className="workspace-nav__icon" />
          <span className="workspace-nav__label">{t[item.key]}</span>
        </span>
        <ul className="workspace-nav__sublist" aria-labelledby={`workspace-nav-${item.key}`}>
          {item.children.map((child) => (
            <li key={child.key} className="workspace-nav__item">
              <NavLink className="workspace-nav__link workspace-nav__link--sub" to={child.to} end={endsAtItself(child)}>
                <span className="workspace-nav__label">{t[child.key]}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </li>
    ) : (
      <li key={item.key} className="workspace-nav__item">
        {link('workspace-nav', item)}
      </li>
    ),
  )

  const tabbarLinks = items.map((item) => (
    <li key={item.key} className="workspace-tabbar__item">
      {link('workspace-tabbar', item)}
    </li>
  ))

  return (
    <>
      <nav className="workspace-nav" aria-label={t.navLabel}>
        <ul className="workspace-nav__list">{sidebarLinks}</ul>
        <div className="workspace-nav__footer">
          <GuideNavButton />
        </div>
      </nav>
      <main id={MAIN_ID} ref={mainRef} tabIndex={-1} className="workspace-main">
        {status === 'ready' ? (
          <Suspense
            fallback={
              <div className="page">
                <SkeletonList />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        ) : status === 'error' ? (
          <div className="page">
            <Notice tone="error" action={{ label: t.retry, onClick: reload }}>
              {t.permissionsError}
            </Notice>
          </div>
        ) : (
          <div className="page">
            <SkeletonList />
          </div>
        )}
      </main>
      <nav className="workspace-tabbar" aria-label={t.navLabel}>
        <ul className="workspace-tabbar__list">{tabbarLinks}</ul>
      </nav>
      {/* Phones have no sidebar: the Guide entry sits in the header instead. */}
      <GuideHeaderButton container={guideSlot} />
    </>
  )
}
